"""
AI 助手主程序 - 基于 stdin/stdout 的消息处理
支持多种功能：聊天、图片生成、视频生成等
"""
import sys
import json
from agent.message_router import MessageRouter
from agent.chat_handler import ChatHandler


def main():
    """主函数 - 初始化路由器并处理消息"""
    try:
        # 初始化消息路由器
        router = MessageRouter()
        
        # 注册聊天处理器
        router.register(ChatHandler())
        
        # TODO: 后续可以添加更多处理器
        # router.register(ImageHandler())
        # router.register(VideoHandler())
        
        # 发送就绪消息
        ready_message = {
            "type": "ready",
            "message": "AI助手已启动",
            "available_handlers": router.get_registered_types()
        }
        print(json.dumps(ready_message, ensure_ascii=False))
        sys.stdout.flush()
        
        # 主循环：从 stdin 读取消息
        for line in sys.stdin:
            try:
                # 跳过空行
                line = line.strip()
                if not line:
                    continue
                
                # 解析 JSON 消息
                message = json.loads(line)
                
                # 路由消息到对应的处理器
                response = router.route(message)
                
                # 输出响应
                print(json.dumps(response, ensure_ascii=False))
                sys.stdout.flush()
                
            except json.JSONDecodeError as e:
                # JSON 解析错误
                error_response = {
                    "type": "error",
                    "message": f"JSON 解析错误: {str(e)}"
                }
                print(json.dumps(error_response, ensure_ascii=False))
                sys.stdout.flush()
                
            except Exception as e:
                # 其他未知错误
                error_response = {
                    "type": "error",
                    "message": f"未知错误: {str(e)}"
                }
                print(json.dumps(error_response, ensure_ascii=False))
                sys.stdout.flush()
    
    except Exception as e:
        # 初始化失败
        error_response = {
            "type": "error",
            "message": f"初始化失败: {str(e)}"
        }
        print(json.dumps(error_response, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
