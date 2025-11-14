"""
聊天处理器 - 处理聊天消息，调用 LLM 生成响应
"""
import os
from typing import Dict, Any
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from .handler_base import BaseHandler
from .tools import tools


class ChatHandler(BaseHandler):
    """聊天处理器 - 使用 LangGraph Agent 处理聊天消息"""

    def __init__(self):
        """初始化聊天处理器"""
        load_dotenv()
        
        # 从环境变量获取配置
        ark_api_key = os.getenv("ARK_API_KEY")
        ark_model_id = os.getenv("ARK_MODEL_ID")
        
        if not ark_api_key or not ark_model_id:
            raise ValueError("缺少必要的环境变量: ARK_API_KEY 或 ARK_MODEL_ID")
        
        # 初始化豆包模型
        self.llm = ChatOpenAI(
            model=ark_model_id,
            api_key=ark_api_key,
            base_url="https://ark.cn-beijing.volces.com/api/v3",
            temperature=0.2,
        )
        
        # 初始化 Memory（用于记录上下文）
        self.memory = MemorySaver()
        
        # 初始化 Agent
        self.agent = create_react_agent(self.llm, tools, checkpointer=self.memory)
        
        # 配置会话
        self.config = {"configurable": {"thread_id": "default_conversation"}}

    def get_type(self) -> str:
        """返回处理器类型"""
        return "chat"

    def handle(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理聊天消息
        
        Args:
            message: {"type": "chat", "message": "用户输入的消息"}
            
        Returns:
            {"type": "chat_response", "message": "AI 响应的消息"}
        """
        try:
            # 提取用户输入
            user_input = message.get("message", "")
            if not user_input:
                return self.create_error_response("消息内容为空")
            
            # 调用 agent 获取响应
            result = self.agent.invoke(
                {"messages": [("user", user_input)]}, 
                self.config
            )
            
            # 提取最后一条 AI 消息
            ai_message = result["messages"][-1]
            
            # 返回响应
            return self.create_response("chat_response", {
                "message": ai_message.content
            })
            
        except Exception as e:
            return self.create_error_response(f"聊天处理失败: {str(e)}")

