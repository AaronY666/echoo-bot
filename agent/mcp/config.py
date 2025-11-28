"""
MCP 配置管理
"""
import os
import json
from typing import List
from dotenv import load_dotenv
from .schemas import MCPServerConfig
from ..logger import log


load_dotenv()


#-------------- 配置项 --------------

ENABLE_MCP = os.getenv("ENABLE_MCP", "false").lower() == "true"
MCP_SERVERS_CONFIG_PATH = os.getenv("MCP_SERVERS_CONFIG", "./mcp_servers.json")
DEBUG_MCP = os.getenv("DEBUG_MCP", "false").lower() == "true"


#-------------- 配置加载函数 --------------

def load_mcp_servers() -> List[MCPServerConfig]:
    """
    加载 MCP Server 配置
    
    从配置文件加载 MCP Server 列表，支持环境变量替换
    
    Returns:
        MCP Server 配置列表
    """
    if not os.path.exists(MCP_SERVERS_CONFIG_PATH):
        if DEBUG_MCP:
            log(f"⚠️ MCP 配置文件不存在: {MCP_SERVERS_CONFIG_PATH}")
        return []
    
    try:
        with open(MCP_SERVERS_CONFIG_PATH, 'r', encoding='utf-8') as f:
            configs = json.load(f)
        
        # 处理环境变量替换（如 ${TOKEN}）
        for config in configs:
            if config.get("auth") and config["auth"].get("token"):
                token = config["auth"]["token"]
                # 支持 ${VAR_NAME} 格式
                if token.startswith("${") and token.endswith("}"):
                    env_var_name = token[2:-1]
                    env_value = os.getenv(env_var_name)
                    if env_value:
                        config["auth"]["token"] = env_value
                    else:
                        log(f"⚠️ 环境变量 {env_var_name} 未设置，Server '{config['name']}' 可能无法认证")
        
        if DEBUG_MCP:
            log(f"✅ 加载了 {len(configs)} 个 MCP Server 配置")
        
        return configs
        
    except json.JSONDecodeError as e:
        log(f"❌ MCP 配置文件解析失败: {str(e)}")
        return []
    except Exception as e:
        log(f"❌ 加载 MCP 配置失败: {str(e)}")
        return []


def save_mcp_servers(configs: List[MCPServerConfig]) -> bool:
    """
    保存 MCP Server 配置到文件
    
    Args:
        configs: MCP Server 配置列表
        
    Returns:
        是否保存成功
    """
    try:
        with open(MCP_SERVERS_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(configs, f, indent=2, ensure_ascii=False)
        
        if DEBUG_MCP:
            log(f"✅ MCP 配置已保存到 {MCP_SERVERS_CONFIG_PATH}")
        
        return True
        
    except Exception as e:
        log(f"❌ 保存 MCP 配置失败: {str(e)}")
        return False

