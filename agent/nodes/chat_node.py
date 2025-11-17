"""
聊天节点 - 处理普通对话
"""
import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from ..state import AgentState
from ..logger import log


load_dotenv()


#-------------- 全局单例 --------------
_llm = None
_agent = None
_memory = None
_config = None


def _init_chat_agent():
    """初始化聊天 Agent（单例模式）"""
    global _llm, _agent, _memory, _config
    
    if _agent is not None:
        return _agent
    
    # 从环境变量获取配置
    ark_api_key = os.getenv("ARK_API_KEY")
    ark_model_id = os.getenv("ARK_MODEL_ID")
    
    if not ark_api_key or not ark_model_id:
        raise ValueError("缺少必要的环境变量: ARK_API_KEY 或 ARK_MODEL_ID")
    
    # 初始化豆包模型
    _llm = ChatOpenAI(
        model=ark_model_id,
        api_key=ark_api_key,
        base_url="https://ark.cn-beijing.volces.com/api/v3",
        temperature=0.2,
    )
    
    # 初始化 Memory（用于记录上下文）
    _memory = MemorySaver()
    
    # 初始化 Agent（暂时不添加 tools，后续可扩展）
    _agent = create_react_agent(_llm, [], checkpointer=_memory)
    
    # 配置会话
    _config = {"configurable": {"thread_id": "default_conversation"}}
    
    log("✅ 聊天 Agent 初始化完成")
    return _agent


def chat_node(state: AgentState) -> AgentState:
    """
    聊天节点 - 处理普通对话
    
    使用 LangGraph 的 create_react_agent 生成响应
    """
    try:
        messages = state.get("messages", [])
        if not messages:
            raise ValueError("没有用户消息")
        
        last_message = messages[-1]
        user_input = last_message.content
        
        log(f"💬 聊天节点处理: {user_input[:50]}...")
        
        # 获取 Agent
        agent = _init_chat_agent()
        
        # 调用 Agent 获取响应
        result = agent.invoke(
            {"messages": [("user", user_input)]}, 
            _config
        )
        
        # 提取最后一条 AI 消息
        ai_message = result["messages"][-1]
        response_text = ai_message.content
        
        log(f"✅ 聊天节点完成")
        
        # 更新状态
        return {
            **state,
            "detailed_content": response_text,
            "error": None
        }
        
    except Exception as e:
        error_msg = f"聊天节点失败: {str(e)}"
        log(f"❌ {error_msg}")
        return {
            **state,
            "error": error_msg
        }
