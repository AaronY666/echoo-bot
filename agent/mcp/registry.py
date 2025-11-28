"""
MCP 工具注册表
"""
from typing import Dict, List, Optional, Any
from .schemas import MCPToolInfo


class MCPToolRegistry:
    """
    工具注册表，管理所有 MCP 工具的元数据
    
    提供工具的注册、查询和搜索功能
    """
    
    def __init__(self):
        self._tools: Dict[str, Any] = {}  # tool_id -> LangChain Tool
        self._tool_info: Dict[str, MCPToolInfo] = {}  # tool_id -> MCPToolInfo
    
    def register_tool(self, tool: Any, server_name: str = ""):
        """
        注册工具
        
        Args:
            tool: LangChain Tool 对象
            server_name: Server 名称（可选，用于构建 tool_id）
        """
        # 从 Tool 对象提取信息
        tool_name = getattr(tool, 'name', str(tool))
        tool_id = f"{server_name}.{tool_name}" if server_name else tool_name
        
        # 存储 Tool 对象
        self._tools[tool_id] = tool
        
        # 存储工具元信息
        self._tool_info[tool_id] = {
            "id": tool_id,
            "server_name": server_name,
            "tool_name": tool_name,
            "description": getattr(tool, 'description', ''),
            "parameters": getattr(tool, 'args_schema', {}) if hasattr(tool, 'args_schema') else {},
            "enabled": True
        }
    
    def unregister_tool(self, tool_id: str):
        """注销工具"""
        self._tools.pop(tool_id, None)
        self._tool_info.pop(tool_id, None)
    
    def unregister_server_tools(self, server_name: str):
        """注销某个 Server 的所有工具"""
        tool_ids_to_remove = [
            tool_id for tool_id, info in self._tool_info.items()
            if info["server_name"] == server_name
        ]
        
        for tool_id in tool_ids_to_remove:
            self.unregister_tool(tool_id)
    
    def get_tool(self, tool_id: str) -> Optional[Any]:
        """获取工具对象"""
        return self._tools.get(tool_id)
    
    def get_tool_info(self, tool_id: str) -> Optional[MCPToolInfo]:
        """获取工具信息"""
        return self._tool_info.get(tool_id)
    
    def get_all_tools(self) -> List[Any]:
        """获取所有工具对象"""
        return list(self._tools.values())
    
    def get_all_tool_info(self) -> List[MCPToolInfo]:
        """获取所有工具信息"""
        return list(self._tool_info.values())
    
    def get_tools_by_server(self, server_name: str) -> List[Any]:
        """获取指定 Server 的所有工具"""
        return [
            tool for tool_id, tool in self._tools.items()
            if self._tool_info.get(tool_id, {}).get("server_name") == server_name
        ]
    
    def search_tool(self, query: str) -> List[MCPToolInfo]:
        """
        搜索工具（基于名称、描述）
        
        Args:
            query: 搜索关键词
            
        Returns:
            匹配的工具信息列表
        """
        query_lower = query.lower()
        results = []
        
        for info in self._tool_info.values():
            # 搜索工具名称和描述
            if (query_lower in info["tool_name"].lower() or
                query_lower in info["description"].lower()):
                results.append(info)
        
        return results
    
    def clear(self):
        """清空所有工具"""
        self._tools.clear()
        self._tool_info.clear()
    
    def count(self) -> int:
        """获取工具总数"""
        return len(self._tools)

