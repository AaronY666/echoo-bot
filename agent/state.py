"""
LangGraph 工作流状态定义
"""
from typing import Literal, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    """工作流状态定义"""
    
    # 消息历史（LangGraph 标准字段）
    messages: list[BaseMessage]
    
    # 路由决策：决定使用哪种工作流
    workflow_type: Literal["quick_and_detailed", "chat", "image", "video"]
    
    # 快速回复（立即返回给用户）
    quick_reply: Optional[str]
    quick_reply_audio: Optional[str]  # 语音 URL（预留）
    
    # 详细内容（后续返回）
    detailed_content: Optional[str]
    detailed_audio: Optional[str]  # 语音 URL（预留）
    
    # 任务参数（从路由节点传递到执行节点）
    task_params: dict
    
    # 错误信息
    error: Optional[str]

