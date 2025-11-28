"""
AI 助手主程序 - 基于 stdin/stdout 的消息处理
使用 LangGraph 架构，支持智能路由和复杂工作流

注意：
- 日志输出到 stderr
- JSON 响应输出到 stdout
"""
import sys
import json
import asyncio
from agent.langgraph_agent import LangGraphAgent
from agent.logger import log


def main():
    """主函数 - 初始化 LangGraph Agent 并处理消息"""
    try:
        #-------------- 初始化 LangGraph Agent --------------
        agent = LangGraphAgent()
        
        #-------------- 发送就绪消息 --------------
        ready_message = {
            "type": "ready",
            "message": "AI助手已启动 (LangGraph架构 + MCP支持)",
            "available_handlers": ["chat", "image", "video", "quick_and_detailed", "mcp_tool"]
        }
        # 就绪消息输出到 stdout（JSON 格式）
        print(json.dumps(ready_message, ensure_ascii=False))
        sys.stdout.flush()
        
        # 日志输出到 stderr
        log("✅ AI 助手已启动，等待消息...")
        
        #-------------- 主循环：从 stdin 读取消息 --------------
        for line in sys.stdin:
            try:
                # 跳过空行
                line = line.strip()
                if not line:
                    continue
                
                # 解析 JSON 消息
                message = json.loads(line)
                
                # 检查消息类型
                message_type = message.get("type", "chat")
                
                # 处理不同类型的消息
                if message_type == "get_history":
                    # 获取历史记录
                    history = agent.get_chat_history(limit=20)
                    response = {
                        "type": "chat_history",
                        "data": history
                    }
                
                elif message_type == "mcp_add_server":
                    # 动态添加 MCP Server
                    from agent.nodes.mcp_tool_node import get_mcp_manager
                    mcp_manager = get_mcp_manager()
                    
                    if mcp_manager:
                        success = asyncio.run(mcp_manager.add_server(
                            name=message.get("name"),
                            url=message.get("url"),
                            auth=message.get("auth"),
                            description=message.get("description", "")
                        ))
                        response = {
                            "type": "mcp_server_added",
                            "success": success,
                            "name": message.get("name")
                        }
                    else:
                        response = {
                            "type": "error",
                            "message": "MCP Manager 未初始化"
                        }
                
                elif message_type == "mcp_remove_server":
                    # 移除 MCP Server
                    from agent.nodes.mcp_tool_node import get_mcp_manager
                    mcp_manager = get_mcp_manager()
                    
                    if mcp_manager:
                        success = asyncio.run(mcp_manager.remove_server(message.get("name")))
                        response = {
                            "type": "mcp_server_removed",
                            "success": success,
                            "name": message.get("name")
                        }
                    else:
                        response = {
                            "type": "error",
                            "message": "MCP Manager 未初始化"
                        }
                
                elif message_type == "mcp_list_servers":
                    # 列出所有 MCP Server
                    from agent.nodes.mcp_tool_node import get_mcp_manager
                    mcp_manager = get_mcp_manager()
                    
                    if mcp_manager:
                        servers = mcp_manager.get_server_status()
                        response = {
                            "type": "mcp_servers_list",
                            "data": servers
                        }
                    else:
                        response = {
                            "type": "mcp_servers_list",
                            "data": {}
                        }
                
                elif message_type == "mcp_list_tools":
                    # 列出所有可用工具
                    from agent.nodes.mcp_tool_node import get_mcp_manager
                    mcp_manager = get_mcp_manager()
                    
                    if mcp_manager:
                        tools = mcp_manager.get_all_tools()
                        response = {
                            "type": "mcp_tools_list",
                            "data": tools
                        }
                    else:
                        response = {
                            "type": "mcp_tools_list",
                            "data": []
                        }
                
                elif message_type == "mcp_reload":
                    # 重新加载所有 MCP Server
                    from agent.nodes.mcp_tool_node import get_mcp_manager
                    mcp_manager = get_mcp_manager()
                    
                    if mcp_manager:
                        success = asyncio.run(mcp_manager.reload_all())
                        response = {
                            "type": "mcp_reloaded",
                            "success": success
                        }
                    else:
                        response = {
                            "type": "error",
                            "message": "MCP Manager 未初始化"
                        }
                
                else:
                    # 使用 LangGraph Agent 处理消息
                    response = agent.process(message)
                
                # 输出响应到 stdout（JSON 格式）
                print(json.dumps(response, ensure_ascii=False))
                sys.stdout.flush()
                
            except json.JSONDecodeError as e:
                # JSON 解析错误
                log(f"❌ JSON 解析错误: {str(e)}")
                error_response = {
                    "type": "error",
                    "message": f"JSON 解析错误: {str(e)}"
                }
                print(json.dumps(error_response, ensure_ascii=False))
                sys.stdout.flush()
                
            except Exception as e:
                # 其他未知错误
                log(f"❌ 未知错误: {str(e)}")
                error_response = {
                    "type": "error",
                    "message": f"未知错误: {str(e)}"
                }
                print(json.dumps(error_response, ensure_ascii=False))
                sys.stdout.flush()
    
    except Exception as e:
        # 初始化失败
        log(f"❌ 初始化失败: {str(e)}")
        error_response = {
            "type": "error",
            "message": f"初始化失败: {str(e)}"
        }
        print(json.dumps(error_response, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()

