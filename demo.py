import os
import sys
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from agent.tools import tools

load_dotenv()

ark_api_key = os.getenv("ARK_API_KEY")
ark_model_id = os.getenv("ARK_MODEL_ID")

# 1️⃣ 初始化豆包模型
llm = ChatOpenAI(
    model=ark_model_id,
    api_key=ark_api_key,
    base_url="https://ark.cn-beijing.volces.com/api/v3",
    temperature=0.2,
)

# 2️⃣ Memory，用于记录上下文
memory = MemorySaver()

# 3️⃣ 初始化 Agent
agent = create_react_agent(llm, tools, checkpointer=memory)

# 4️⃣ 配置会话
config = {"configurable": {"thread_id": "default_conversation"}}

# 5️⃣ 处理消息函数
def handle_message(msg):
    """处理来自 Electron 主进程的消息"""
    try:
        if msg.get("type") == "chat":
            user_input = msg.get("message", "")
            if not user_input:
                raise ValueError("消息内容为空")
            
            # 调用 agent 获取响应
            result = agent.invoke({"messages": [("user", user_input)]}, config)
            
            # 提取最后一条 AI 消息
            ai_message = result["messages"][-1]
            
            # 返回 JSON 格式响应
            response = {
                "type": "chat_response",
                "message": ai_message.content
            }
            print(json.dumps(response, ensure_ascii=False))
            sys.stdout.flush()
            
    except Exception as e:
        # 返回错误响应
        error_response = {
            "type": "error",
            "message": str(e)
        }
        print(json.dumps(error_response, ensure_ascii=False))
        sys.stdout.flush()

# 6️⃣ 主循环：从 stdin 读取消息
print(json.dumps({"type": "ready", "message": "AI助手已启动"}, ensure_ascii=False))
sys.stdout.flush()

for line in sys.stdin:
    try:
        line = line.strip()
        if not line:
            continue
        
        msg = json.loads(line)
        handle_message(msg)
        
    except json.JSONDecodeError as e:
        error_response = {
            "type": "error",
            "message": f"JSON 解析错误: {str(e)}"
        }
        print(json.dumps(error_response, ensure_ascii=False))
        sys.stdout.flush()
    except Exception as e:
        error_response = {
            "type": "error",
            "message": f"未知错误: {str(e)}"
        }
        print(json.dumps(error_response, ensure_ascii=False))
        sys.stdout.flush()
