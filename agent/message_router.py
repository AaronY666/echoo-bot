"""
消息路由器 - 根据消息类型分发到对应的处理器
"""
from typing import Dict, Any, Optional
from .handler_base import BaseHandler


class MessageRouter:
    """消息路由器 - 管理和分发消息到对应的处理器"""

    def __init__(self):
        """初始化路由器"""
        self.handlers: Dict[str, BaseHandler] = {}

    def register(self, handler: BaseHandler) -> None:
        """
        注册处理器
        
        Args:
            handler: 要注册的处理器实例
        """
        handler_type = handler.get_type()
        self.handlers[handler_type] = handler
        print(f"✅ 已注册处理器: {handler_type}")

    def route(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        路由消息到对应的处理器
        
        Args:
            message: 输入消息，必须包含 "type" 字段
            
        Returns:
            处理器返回的响应消息
        """
        # 提取消息类型
        msg_type = message.get("type")
        
        if not msg_type:
            return self._create_error_response("消息缺少 'type' 字段")
        
        # 查找对应的处理器
        handler = self.handlers.get(msg_type)
        
        if not handler:
            available_types = ", ".join(self.handlers.keys())
            return self._create_error_response(
                f"未知消息类型: {msg_type}。可用类型: {available_types}"
            )
        
        # 调用处理器
        try:
            return handler.handle(message)
        except Exception as e:
            return self._create_error_response(
                f"处理器执行失败 [{msg_type}]: {str(e)}"
            )

    def get_registered_types(self) -> list:
        """
        获取所有已注册的处理器类型
        
        Returns:
            处理器类型列表
        """
        return list(self.handlers.keys())

    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """
        创建错误响应
        
        Args:
            error_message: 错误信息
            
        Returns:
            错误响应消息
        """
        return {
            "type": "error",
            "message": error_message
        }

