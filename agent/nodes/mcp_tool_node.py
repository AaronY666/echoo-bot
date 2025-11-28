"""
MCP 工具调用节点
"""
import os
import json
from typing import Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from dotenv import load_dotenv
from ..state import AgentState
from ..mcp.manager import MCPManager
from ..mcp.config import ENABLE_MCP, load_mcp_servers, DEBUG_MCP
from ..logger import log


load_dotenv()


#-------------- 全局单例 --------------
_mcp_manager: Optional[MCPManager] = None
_initialized = False


def get_mcp_manager() -> Optional[MCPManager]:
    """获取 MCP Manager 单例（同步版本）"""
    global _mcp_manager, _initialized
    
    if _initialized:
        return _mcp_manager
    
    if not ENABLE_MCP:
        if DEBUG_MCP:
            log("⚠️ MCP 功能未启用（ENABLE_MCP=false）")
        _initialized = True
        return None
    
    try:
        import asyncio
        
        _mcp_manager = MCPManager()
        
        # 加载配置的 MCP Server
        servers = load_mcp_servers()
        if servers:
            # 使用 asyncio.run 同步执行异步初始化
            asyncio.run(_mcp_manager.initialize(servers))
            log(f"✅ MCP Manager 已初始化，连接了 {len(servers)} 个 Server")
        else:
            log("⚠️ 没有配置 MCP Server")
        
        _initialized = True
        return _mcp_manager
        
    except Exception as e:
        log(f"❌ MCP Manager 初始化失败: {str(e)}")
        import traceback
        log(traceback.format_exc())
        _initialized = True
        return None


def create_tool_selector_llm():
    """创建工具选择用的 LLM"""
    ark_api_key = os.getenv("ARK_API_KEY")
    ark_model_id = os.getenv("ARK_MODEL_ID")
    
    if not ark_api_key or not ark_model_id:
        raise ValueError("缺少必要的环境变量: ARK_API_KEY 或 ARK_MODEL_ID")
    
    return ChatOpenAI(
        model=ark_model_id,
        api_key=ark_api_key,
        base_url="https://ark.cn-beijing.volces.com/api/v3",
        temperature=0.1,  # 工具选择需要更确定性
    )


def mcp_tool_node(state: AgentState) -> AgentState:
    """
    MCP 工具调用节点（同步版本）
    
    从 state.task_params 中获取：
    - tool_name: 工具名称（可选）
    - server_name: MCP Server 名称（可选）
    - params: 工具参数（可选）
    
    如果没有明确的工具信息，使用 LLM 进行工具选择
    """
    try:
        import asyncio
        
        messages = state.get("messages", [])
        if not messages:
            raise ValueError("没有用户消息")
        
        last_message = messages[-1]
        user_input = last_message.content
        
        log(f"🔧 MCP 工具节点处理: {user_input[:50]}...")
        
        # 获取 MCP Manager
        manager = get_mcp_manager()
        if not manager or not manager.is_connected:
            raise ValueError("MCP Manager 未初始化或未连接")
        
        # 从 task_params 获取工具调用信息
        task_params = state.get("task_params", {})
        tool_name = task_params.get("tool_name")
        
        # 如果没有明确的工具名称，使用 LLM 进行工具选择
        if not tool_name:
            tool_name, params = _select_tool_with_llm(manager, user_input)
        else:
            params = task_params.get("params", {})
        
        # 调用工具
        log(f"🔧 准备调用工具: {tool_name}")
        
        # 从注册表获取工具
        tool = manager.registry.get_tool(tool_name)
        if not tool:
            # 尝试模糊匹配
            all_tools = manager.registry.get_all_tool_info()
            
            # 策略1: 查找工具名包含查询词的工具
            matching_tools = [t for t in all_tools if tool_name.lower() in t['tool_name'].lower()]
            
            # 策略2: 如果策略1没找到，尝试分词匹配（如 browser_open -> browser + open）
            if not matching_tools:
                query_words = tool_name.lower().replace('_', ' ').replace('.', ' ').split()
                for t in all_tools:
                    tool_words = t['tool_name'].lower().replace('_', ' ').replace('.', ' ').split()
                    # 如果查询词都在工具名中，认为匹配
                    if all(word in tool_words for word in query_words):
                        matching_tools.append(t)
            
            if matching_tools:
                log(f"⚠️ 未找到精确匹配的工具 '{tool_name}'，使用模糊匹配")
                log(f"   候选工具: {[t['id'] for t in matching_tools[:3]]}")
                # 使用第一个匹配的工具
                tool_name = matching_tools[0]['id']
                tool = manager.registry.get_tool(tool_name)
                log(f"   ✅ 使用工具: {tool_name}")
            
            if not tool:
                # 列出所有可用工具供调试
                available_tools = [t['id'] for t in all_tools[:10]]
                log(f"❌ 可用的工具（前10个）: {available_tools}")
                raise ValueError(f"工具 '{tool_name}' 不存在")
        
        # 调用工具（LangChain Tool 的标准调用方式）
        # langchain-mcp-adapters 返回的工具只支持异步调用
        try:
            # 优先使用异步调用
            if hasattr(tool, 'ainvoke'):
                result = asyncio.run(tool.ainvoke(params))
            elif hasattr(tool, 'invoke'):
                result = tool.invoke(params)
            else:
                # 兜底：直接调用
                result = asyncio.run(tool(params))
        except Exception as e:
            log(f"❌ 工具调用异常: {str(e)}")
            raise
        
        log(f"✅ 工具调用成功")
        
        # 将结果添加到 messages
        from datetime import datetime
        
        tool_result_message = AIMessage(
            content=f"[工具调用结果]\n工具: {tool_name}\n结果: {result}",
            additional_kwargs={"timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
        )
        
        updated_messages = messages + [tool_result_message]
        
        return {
            **state,
            "messages": updated_messages,
            "detailed_content": str(result),  # 临时结果，会被 chat_node 合成
            "error": None
        }
        
    except Exception as e:
        error_msg = f"MCP 工具调用失败: {str(e)}"
        log(f"❌ {error_msg}")
        import traceback
        log(traceback.format_exc())
        return {
            **state,
            "error": error_msg
        }


def _select_tool_with_llm(manager: MCPManager, user_input: str):
    """
    使用 LLM 选择合适的工具
    
    Args:
        manager: MCP Manager
        user_input: 用户输入
        
    Returns:
        (tool_name, params) 元组
    """
    # 获取所有可用工具
    all_tools = manager.get_all_tools()
    
    if not all_tools:
        raise ValueError("没有可用的 MCP 工具")
    
    # 构建工具列表描述（包含参数信息）
    tools_desc = []
    for i, tool_info in enumerate(all_tools, 1):
        # 提取参数信息
        params_info = "无参数"
        parameters = tool_info.get('parameters', {})
        if parameters and hasattr(parameters, '__annotations__'):
            # 如果是 Pydantic 模型，提取字段
            try:
                fields = parameters.__annotations__.keys()
                params_info = ", ".join(fields)
            except:
                params_info = "查看工具描述"
        
        tools_desc.append(
            f"{i}. ID: `{tool_info['id']}`\n"
            f"   功能: {tool_info['description']}\n"
            f"   参数: {params_info}"
        )
    
    tools_text = "\n".join(tools_desc)
    
    # 构建提示词
    system_prompt = f"""你是一个工具选择专家。你的任务是从工具列表中选择最合适的工具。

## 可用工具
{tools_text}

## 选择规则
1. **必须使用完整的工具 ID**（如 `autotest_browser.browser_navigate`）
2. **不要臆造工具名**，只能从上面的列表中选择
3. 仔细阅读每个工具的功能描述，选择最匹配用户需求的
4. 工具 ID 包含两部分：`服务名.功能名`，必须完整复制

## 参数提取规则
1. **仔细分析用户输入，提取工具所需的参数**
2. 常见参数示例：
   - `url`: 网址（如 "https://www.baidu.com"）
   - `text`: 文本内容
   - `element`: 元素描述
   - `ref`: 元素引用

## 示例
用户说："帮我打开百度搜索天气"
→ 工具: `autotest_browser.browser_navigate`
→ 参数: {{"url": "https://www.baidu.com/s?wd=天气"}}

用户说："打开谷歌"
→ 工具: `autotest_browser.browser_navigate`
→ 参数: {{"url": "https://www.google.com"}}

## 返回格式
返回 JSON（不要用 markdown 代码块）：
{{
  "tool_id": "完整的工具ID",
  "params": {{
    "参数名": "从用户输入提取的参数值"
  }},
  "reason": "选择原因"
}}

**重要**: 如果工具需要 URL，必须构造完整的 URL（包含 https://）
"""

    user_prompt = f"用户需求：{user_input}\n\n请选择工具并提取参数（JSON格式）："
    
    # 调用 LLM
    llm = create_tool_selector_llm()
    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ])
    
    response_text = response.content.strip()
    
    # 尝试提取 JSON
    if "```json" in response_text:
        json_start = response_text.find("```json") + 7
        json_end = response_text.find("```", json_start)
        response_text = response_text[json_start:json_end].strip()
    elif "```" in response_text:
        json_start = response_text.find("```") + 3
        json_end = response_text.find("```", json_start)
        response_text = response_text[json_start:json_end].strip()
    
    try:
        result = json.loads(response_text)
        tool_id = result.get("tool_id")
        params = result.get("params", {})
        reason = result.get("reason", "")
        
        if not tool_id:
            raise ValueError(f"无法找到合适的工具: {reason}")
        
        if DEBUG_MCP:
            log(f"🔧 LLM 选择工具: {tool_id}")
            log(f"   原因: {reason}")
            log(f"   参数: {json.dumps(params, ensure_ascii=False)}")
        
        return tool_id, params
        
    except json.JSONDecodeError:
        log(f"⚠️ LLM 返回格式错误: {response_text}")
        # 降级：选择第一个工具
        if all_tools:
            return all_tools[0]["id"], {}
        raise ValueError("无法解析 LLM 返回的工具选择结果")

