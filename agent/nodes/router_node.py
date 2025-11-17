"""
路由节点 - 使用 LLM 分析用户意图，决定工作流类型
"""
import os
import json
from typing import Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from dotenv import load_dotenv
from ..state import AgentState
from ..logger import log


load_dotenv()


class RouterResult:
    """路由结果"""
    def __init__(self, workflow_type: str, params: dict = None):
        self.workflow_type = workflow_type
        self.params = params or {}


def create_router_llm():
    """创建路由用的 LLM"""
    ark_api_key = os.getenv("ARK_API_KEY")
    ark_model_id = os.getenv("ARK_MODEL_ID")
    
    if not ark_api_key or not ark_model_id:
        raise ValueError("缺少必要的环境变量: ARK_API_KEY 或 ARK_MODEL_ID")
    
    return ChatOpenAI(
        model=ark_model_id,
        api_key=ark_api_key,
        base_url="https://ark.cn-beijing.volces.com/api/v3",
        temperature=0.1,  # 路由决策需要更确定性
    )


def router_node(state: AgentState) -> AgentState:
    """
    路由节点 - 分析用户意图并决定工作流类型
    
    工作流类型：
    - quick_and_detailed: 需要快速回复 + 详细内容（复杂查询、生成任务等）
    - chat: 普通对话（简单问答、闲聊等）
    - image: 图片生成（明确要求生成图片）
    - video: 视频生成（明确要求生成视频）
    """
    try:
        # 获取最后一条用户消息
        messages = state.get("messages", [])
        if not messages:
            raise ValueError("没有用户消息")
        
        last_message = messages[-1]
        user_input = last_message.content
        
        # 构建路由提示词
        system_prompt = """你是一个智能路由助手，负责分析用户意图并决定使用哪种工作流。

工作流类型：
1. "quick_and_detailed" - 用于需要较长时间处理的请求，如：
   - 需要深入分析或详细解答的问题
   - 需要生成长文本内容
   - 需要查询或处理复杂信息
   对于这类请求，系统会先给用户一个快速回复（如"正在为你处理..."），然后再返回详细内容

2. "chat" - 用于简单的日常对话，如：
   - 简单问候、闲聊
   - 简短的问答（答案可以立即给出）
   - 不需要复杂处理的对话
   
3. "image" - 用户明确要求生成图片，如：
   - "帮我生成一张图片"
   - "画一个..."
   
4. "video" - 用户明确要求生成视频，如：
   - "帮我生成一个视频"
   - "制作一个..."

请分析用户消息，返回 JSON 格式：
{
  "workflow_type": "选择的工作流类型",
  "reason": "选择原因（简短说明）"
}

注意：如果不确定，默认使用 "chat"。只有在用户明确需要复杂处理时才使用 "quick_and_detailed"。"""

        user_prompt = f"用户消息：{user_input}\n\n请分析并返回路由决策（JSON格式）："
        
        # 调用 LLM 进行路由决策
        llm = create_router_llm()
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ])
        
        # 解析响应
        response_text = response.content.strip()
        
        # 尝试提取 JSON（可能被包裹在 markdown 代码块中）
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
            workflow_type = result.get("workflow_type", "chat")
            reason = result.get("reason", "")
            
            log(f"🔀 路由决策: {workflow_type} (原因: {reason})")
            
        except json.JSONDecodeError:
            log(f"⚠️ 路由 LLM 返回格式错误，默认使用 chat: {response_text}")
            workflow_type = "chat"
        
        # 更新状态
        return {
            **state,
            "workflow_type": workflow_type,
            "task_params": {},
            "error": None
        }
        
    except Exception as e:
        log(f"❌ 路由节点错误: {str(e)}")
        # 出错时默认使用普通聊天
        return {
            **state,
            "workflow_type": "chat",
            "task_params": {},
            "error": f"路由失败: {str(e)}"
        }

