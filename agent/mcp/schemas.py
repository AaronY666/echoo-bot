"""
MCP 数据结构定义
"""
from typing import Optional, Dict, Any
from typing_extensions import TypedDict


class MCPServerConfig(TypedDict):
    """MCP Server 配置"""
    name: str
    url: str
    description: str
    enabled: bool
    auth: Optional[Dict[str, Any]]


class MCPToolInfo(TypedDict):
    """MCP 工具信息"""
    id: str                    # 唯一标识: {server_name}.{tool_name}
    server_name: str
    tool_name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema
    enabled: bool


class MCPServerStatus(TypedDict):
    """MCP Server 状态"""
    name: str
    url: str
    connected: bool
    tools_count: int
    last_error: Optional[str]

