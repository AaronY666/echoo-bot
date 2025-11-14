"""
基础处理器抽象类 - 定义所有处理器的接口
"""
from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseHandler(ABC):
    """所有消息处理器的基类"""

    @abstractmethod
    def handle(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理消息并返回响应
        
        Args:
            message: 输入消息，格式为 {"type": "...", ...其他字段}
            
        Returns:
            响应消息，格式为 {"type": "...", ...其他字段}
        """
        pass

    @abstractmethod
    def get_type(self) -> str:
        """
        返回处理器类型（用于消息路由）
        
        Returns:
            处理器类型字符串，如 "chat", "image", "video"
        """
        pass

    def create_response(self, response_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建标准响应格式
        
        Args:
            response_type: 响应类型
            data: 响应数据
            
        Returns:
            标准格式的响应消息
        """
        return {
            "type": response_type,
            **data
        }

    def create_error_response(self, error_message: str) -> Dict[str, Any]:
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

