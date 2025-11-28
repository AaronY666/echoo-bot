"""
MCP (Model Context Protocol) 集成模块

提供 MCP Server 的连接、工具管理和动态加载能力
"""
from .manager import MCPManager
from .schemas import MCPServerConfig, MCPToolInfo, MCPServerStatus

__all__ = [
    "MCPManager",
    "MCPServerConfig",
    "MCPToolInfo",
    "MCPServerStatus",
]

