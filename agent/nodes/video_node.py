"""
视频生成节点 - 预留接口，暂时返回占位响应
"""
from ..state import AgentState
from ..logger import log


def video_node(state: AgentState) -> AgentState:
    """
    视频生成节点 - 预留实现
    
    后续可对接真实的视频生成服务（如 Runway、Pika 等）
    """
    try:
        messages = state.get("messages", [])
        if not messages:
            raise ValueError("没有用户消息")
        
        last_message = messages[-1]
        user_input = last_message.content
        
        log(f"🎬 视频生成节点（占位）: {user_input[:50]}...")
        
        # 占位响应
        placeholder_response = f"视频生成功能预留中。用户请求：{user_input}"
        
        log(f"✅ 视频节点完成（占位）")
        
        return {
            **state,
            "detailed_content": placeholder_response,
            "error": None
        }
        
    except Exception as e:
        error_msg = f"视频节点失败: {str(e)}"
        log(f"❌ {error_msg}")
        return {
            **state,
            "error": error_msg
        }

