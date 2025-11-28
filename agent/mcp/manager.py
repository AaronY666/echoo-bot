"""
MCP Server 管理器 - 支持动态添加/移除（热插拔）
"""
from typing import Dict, List, Optional
from .client import MCPClient
from .registry import MCPToolRegistry
from .schemas import MCPServerConfig, MCPServerStatus
from .config import DEBUG_MCP
from ..logger import log


class MCPManager:
    """
    管理多个 MCP Server，支持动态添加/移除（热插拔）
    
    核心功能：
    - 动态添加/移除 MCP Server
    - 工具注册和管理
    - 状态监控
    """
    
    def __init__(self):
        self.client: Optional[MCPClient] = None
        self.registry = MCPToolRegistry()
        self._server_configs: Dict[str, MCPServerConfig] = {}
        self._initialized = False
    
    async def initialize(self, server_configs: List[MCPServerConfig]):
        """
        初始化 MCP Manager（加载配置的 Server）
        
        Args:
            server_configs: MCP Server 配置列表
        """
        for config in server_configs:
            self._server_configs[config["name"]] = config
        
        await self._rebuild_client()
        self._initialized = True
        
        if DEBUG_MCP:
            log(f"✅ MCP Manager 已初始化，配置了 {len(self._server_configs)} 个 Server")
    
    async def add_server(self, name: str, url: str, auth: dict = None, description: str = "") -> bool:
        """
        动态添加 MCP Server（热插拔）
        
        Args:
            name: Server 名称
            url: Server URL
            auth: 认证信息（可选）
            description: 描述
            
        Returns:
            是否添加成功
        """
        try:
            # 检查是否已存在
            if name in self._server_configs:
                log(f"⚠️ MCP Server '{name}' 已存在")
                return False
            
            config: MCPServerConfig = {
                "name": name,
                "url": url,
                "description": description,
                "enabled": True,
                "auth": auth
            }
            
            self._server_configs[name] = config
            
            # 重建客户端以包含新 Server
            await self._rebuild_client()
            
            log(f"✅ MCP Server '{name}' 已添加")
            return True
            
        except Exception as e:
            log(f"❌ 添加 MCP Server '{name}' 失败: {str(e)}")
            return False
    
    async def remove_server(self, name: str) -> bool:
        """
        移除 MCP Server
        
        Args:
            name: Server 名称
            
        Returns:
            是否移除成功
        """
        try:
            if name not in self._server_configs:
                log(f"⚠️ MCP Server '{name}' 不存在")
                return False
            
            del self._server_configs[name]
            
            # 重建客户端以排除已移除的 Server
            await self._rebuild_client()
            
            # 从注册表中移除工具
            self.registry.unregister_server_tools(name)
            
            log(f"✅ MCP Server '{name}' 已移除")
            return True
            
        except Exception as e:
            log(f"❌ 移除 MCP Server '{name}' 失败: {str(e)}")
            return False
    
    async def reload_server(self, name: str) -> bool:
        """
        重新连接 MCP Server（刷新工具列表）
        
        Args:
            name: Server 名称
            
        Returns:
            是否重新加载成功
        """
        try:
            if name not in self._server_configs:
                log(f"⚠️ MCP Server '{name}' 不存在")
                return False
            
            # 重建客户端
            await self._rebuild_client()
            
            log(f"✅ MCP Server '{name}' 已重新加载")
            return True
            
        except Exception as e:
            log(f"❌ 重新加载 MCP Server '{name}' 失败: {str(e)}")
            return False
    
    async def reload_all(self) -> bool:
        """
        重新加载所有 MCP Server
        
        Returns:
            是否重新加载成功
        """
        try:
            await self._rebuild_client()
            log(f"✅ 已重新加载所有 MCP Server")
            return True
        except Exception as e:
            log(f"❌ 重新加载失败: {str(e)}")
            return False
    
    def get_all_tools(self) -> List[dict]:
        """获取所有 MCP Server 的工具列表"""
        return self.registry.get_all_tool_info()
    
    def get_server_status(self) -> Dict[str, MCPServerStatus]:
        """获取所有 Server 的状态"""
        status = {}
        for name, config in self._server_configs.items():
            tools = self.registry.get_tools_by_server(name)
            status[name] = {
                "name": name,
                "url": config["url"],
                "connected": self.client is not None and self.client.is_connected,
                "tools_count": len(tools),
                "last_error": None
            }
        return status
    
    def get_server_list(self) -> List[MCPServerConfig]:
        """获取所有 Server 配置"""
        return list(self._server_configs.values())
    
    async def _rebuild_client(self):
        """重建 MCP 客户端（用于热插拔）"""
        # 关闭旧客户端
        if self.client:
            await self.client.close()
        
        # 获取启用的配置
        enabled_configs = [
            config for config in self._server_configs.values()
            if config.get("enabled", True)
        ]
        
        if not enabled_configs:
            self.client = None
            self.registry.clear()
            if DEBUG_MCP:
                log("⚠️ 没有启用的 MCP Server")
            return
        
        # 创建新客户端
        self.client = MCPClient()
        await self.client.initialize(enabled_configs)
        
        # 刷新工具注册表
        if self.client.is_connected:
            tools = await self.client.get_tools()
            self.registry.clear()
            
            # 注册所有工具
            # 注意：langchain-mcp-adapters 返回的工具可能已经包含 server 信息
            for tool in tools:
                # 尝试从 tool 名称中提取 server 名称
                # 通常格式为: "server_name__tool_name"
                tool_name = getattr(tool, 'name', str(tool))
                server_name = ""
                
                if "__" in tool_name:
                    server_name, _ = tool_name.split("__", 1)
                else:
                    # 如果工具名称不包含 server 前缀，尝试从配置中匹配
                    # 假设只有一个 enabled 的 server 时，使用该 server 的名称
                    if len(enabled_configs) == 1:
                        server_name = enabled_configs[0]["name"]
                
                self.registry.register_tool(tool, server_name)
            
            if DEBUG_MCP:
                log(f"✅ 已注册 {self.registry.count()} 个工具")
                # 输出前几个工具 ID 用于调试
                all_tool_info = self.registry.get_all_tool_info()
                if all_tool_info:
                    log(f"📋 工具示例:")
                    for i, tool_info in enumerate(all_tool_info[:5]):
                        log(f"   {i+1}. {tool_info['id']}")
    
    @property
    def is_initialized(self) -> bool:
        """检查是否已初始化"""
        return self._initialized
    
    @property
    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self.client is not None and self.client.is_connected

