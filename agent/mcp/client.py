"""
MCP 客户端封装（基于 langchain-mcp-adapters）
"""
from typing import Dict, List, Optional, Any
from langchain_mcp_adapters.client import MultiServerMCPClient
from .schemas import MCPServerConfig
from ..logger import log


class MCPClient:
    """
    封装 langchain-mcp-adapters 的 MultiServerMCPClient
    提供更友好的 API 和状态管理
    """
    
    def __init__(self):
        self._client: Optional[MultiServerMCPClient] = None
        self._server_configs: Dict[str, MCPServerConfig] = {}
        self._connected = False
    
    async def initialize(self, server_configs: List[MCPServerConfig]):
        """
        初始化 MCP 客户端
        
        Args:
            server_configs: MCP Server 配置列表
        """
        if not server_configs:
            log("⚠️ 没有启用的 MCP Server")
            return
        
        # 转换为 MultiServerMCPClient 所需的格式
        client_config = {}
        
        for config in server_configs:
            if not config.get("enabled", True):
                continue
            
            server_config: Dict[str, Any] = {
                "transport": "streamable_http",  # 默认使用 HTTP
                "url": config["url"]
            }
            
            # 添加认证信息（如果有）
            if config.get("auth"):
                auth = config["auth"]
                if auth.get("type") == "bearer" and auth.get("token"):
                    server_config["headers"] = {
                        "Authorization": f"Bearer {auth['token']}"
                    }
                elif auth.get("type") == "api_key" and auth.get("key"):
                    server_config["headers"] = {
                        "X-API-Key": auth['key']
                    }
            
            client_config[config["name"]] = server_config
            self._server_configs[config["name"]] = config
        
        if not client_config:
            log("⚠️ 没有有效的 MCP Server 配置")
            return
        
        try:
            # 创建客户端
            self._client = MultiServerMCPClient(client_config)
            self._connected = True
            log(f"✅ MCP 客户端已初始化，连接了 {len(client_config)} 个 Server")
        except Exception as e:
            log(f"❌ MCP 客户端初始化失败: {str(e)}")
            self._client = None
            self._connected = False
    
    async def get_tools(self) -> List[Any]:
        """
        获取所有 MCP 工具（已转换为 LangChain Tool 格式）
        
        Returns:
            LangChain Tool 列表
        """
        if not self._client:
            return []
        
        try:
            tools = await self._client.get_tools()
            log(f"✅ 获取了 {len(tools)} 个 MCP 工具")
            return tools
        except Exception as e:
            log(f"❌ 获取 MCP 工具失败: {str(e)}")
            return []
    
    async def get_resources(self) -> List[dict]:
        """
        获取所有 MCP 资源
        
        Returns:
            资源列表
        """
        if not self._client:
            return []
        
        try:
            resources = await self._client.get_resources()
            log(f"✅ 获取了 {len(resources)} 个 MCP 资源")
            return resources
        except Exception as e:
            log(f"❌ 获取 MCP 资源失败: {str(e)}")
            return []
    
    async def get_prompts(self) -> List[dict]:
        """
        获取所有 MCP 提示词模板
        
        Returns:
            提示词模板列表
        """
        if not self._client:
            return []
        
        try:
            prompts = await self._client.get_prompts()
            log(f"✅ 获取了 {len(prompts)} 个 MCP 提示词模板")
            return prompts
        except Exception as e:
            log(f"❌ 获取 MCP 提示词模板失败: {str(e)}")
            return []
    
    async def close(self):
        """关闭所有连接"""
        if self._client:
            try:
                await self._client.close()
                self._connected = False
                log("✅ MCP 客户端已关闭")
            except Exception as e:
                log(f"⚠️ 关闭 MCP 客户端失败: {str(e)}")
    
    @property
    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self._connected
    
    @property
    def server_names(self) -> List[str]:
        """获取所有 Server 名称"""
        return list(self._server_configs.keys())

