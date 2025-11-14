# Agent 模块说明

## 架构概述

本模块采用**消息路由器 + 处理器**的架构，便于扩展新功能。

```
消息 → MessageRouter → 对应的 Handler → 响应
```

## 目录结构

```
agent/
├── __init__.py              # 模块导出
├── handler_base.py          # 基础处理器抽象类
├── message_router.py        # 消息路由器
├── chat_handler.py          # 聊天处理器（已实现）
├── image_handler.py         # 图片生成处理器（占位示例）
├── video_handler.py         # 视频生成处理器（占位示例）
├── tools.py                 # LangChain 工具函数
└── README.md                # 本文档
```

## 核心组件

### 1. BaseHandler（基础处理器）

所有处理器必须继承此抽象类，并实现以下方法：

```python
from agent.handler_base import BaseHandler

class MyHandler(BaseHandler):
    def get_type(self) -> str:
        """返回处理器类型，用于消息路由"""
        return "my_type"
    
    def handle(self, message: dict) -> dict:
        """处理消息并返回响应"""
        # 处理逻辑
        return self.create_response("my_response", {"key": "value"})
```

**辅助方法**：
- `create_response(type, data)`: 创建标准响应
- `create_error_response(error_message)`: 创建错误响应

### 2. MessageRouter（消息路由器）

负责根据消息类型分发到对应的处理器。

```python
from agent.message_router import MessageRouter
from agent.chat_handler import ChatHandler

# 初始化路由器
router = MessageRouter()

# 注册处理器
router.register(ChatHandler())

# 路由消息
message = {"type": "chat", "message": "你好"}
response = router.route(message)
```

### 3. 已实现的处理器

#### ChatHandler（聊天处理器）

使用 LangGraph + 豆包模型处理聊天消息。

**输入格式**：
```json
{
  "type": "chat",
  "message": "用户输入的消息"
}
```

**输出格式**：
```json
{
  "type": "chat_response",
  "message": "AI 响应的消息"
}
```

## 如何添加新功能

### 步骤 1: 创建新的处理器

在 `agent/` 目录下创建新文件，如 `my_handler.py`：

```python
from typing import Dict, Any
from .handler_base import BaseHandler

class MyHandler(BaseHandler):
    def __init__(self):
        # 初始化所需的模型、配置等
        pass
    
    def get_type(self) -> str:
        return "my_type"  # 定义消息类型
    
    def handle(self, message: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # 1. 提取参数
            param = message.get("param")
            
            # 2. 执行处理逻辑
            result = self.process(param)
            
            # 3. 返回响应
            return self.create_response("my_response", {
                "result": result
            })
        except Exception as e:
            return self.create_error_response(str(e))
```

### 步骤 2: 注册处理器

在 `demo.py` 中注册新处理器：

```python
from agent.my_handler import MyHandler

# 在 main() 函数中
router.register(MyHandler())
```

### 步骤 3: 发送消息

从前端发送对应格式的消息：

```json
{
  "type": "my_type",
  "param": "参数值"
}
```

## 示例：图片生成处理器

### 1. 实现处理器

```python
# agent/image_handler.py
from .handler_base import BaseHandler

class ImageHandler(BaseHandler):
    def __init__(self):
        # 初始化图片生成模型
        from openai import OpenAI
        self.client = OpenAI()
    
    def get_type(self) -> str:
        return "image"
    
    def handle(self, message):
        prompt = message.get("prompt", "")
        size = message.get("size", "1024x1024")
        
        # 调用 DALL-E
        response = self.client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,
            n=1
        )
        
        image_url = response.data[0].url
        
        return self.create_response("image_response", {
            "url": image_url,
            "prompt": prompt
        })
```

### 2. 注册到路由器

```python
# demo.py
from agent.image_handler import ImageHandler

router.register(ImageHandler())
```

### 3. 前端调用

```typescript
// 前端发送图片生成请求
ipcEvent.emit("send-image-request", {
  prompt: "一只可爱的猫咪",
  size: "1024x1024"
});

// 监听响应
ipcEvent.on("image-response", (data) => {
  console.log("图片URL:", data.url);
});
```

### 4. 主进程桥接（需要添加）

```typescript
// WindowManager.ts
ipcMain.on("send-image-request", (_event, data) => {
  pythonManager?.send(JSON.stringify({
    type: "image",
    ...data
  }));
});

pythonManager?.onMessage("image_response", (data) => {
  mainWindow.webContents.send("image-response", data);
});
```

## 错误处理

所有处理器都应该捕获异常并返回错误响应：

```python
try:
    # 处理逻辑
    result = some_function()
    return self.create_response("success", {"result": result})
except ValueError as e:
    return self.create_error_response(f"参数错误: {str(e)}")
except Exception as e:
    return self.create_error_response(f"处理失败: {str(e)}")
```

错误响应格式：
```json
{
  "type": "error",
  "message": "错误信息"
}
```

## 测试

### 单元测试处理器

```python
# test_my_handler.py
from agent.my_handler import MyHandler

def test_my_handler():
    handler = MyHandler()
    
    # 测试正常情况
    message = {"type": "my_type", "param": "test"}
    response = handler.handle(message)
    assert response["type"] == "my_response"
    
    # 测试错误情况
    message = {"type": "my_type"}  # 缺少参数
    response = handler.handle(message)
    assert response["type"] == "error"
```

### 集成测试

```bash
# 通过 stdin 测试完整流程
echo '{"type":"chat","message":"你好"}' | python3 demo.py
```

## 最佳实践

1. **单一职责**：每个处理器只负责一种功能
2. **参数验证**：在 `handle()` 方法中验证输入参数
3. **错误处理**：捕获所有异常，返回友好的错误信息
4. **日志记录**：使用 `print()` 输出日志（避免输出到 stdout）
5. **配置管理**：敏感信息通过环境变量管理
6. **文档注释**：为每个处理器添加清晰的文档字符串

## 扩展建议

### 异步处理

对于耗时操作（如视频生成），可以返回任务 ID，后台异步处理：

```python
def handle(self, message):
    task_id = str(uuid.uuid4())
    
    # 启动后台任务
    threading.Thread(target=self.process_async, args=(task_id, message)).start()
    
    return self.create_response("task_created", {
        "task_id": task_id,
        "status": "processing"
    })
```

### 流式输出

对于聊天等场景，可以支持流式输出：

```python
def handle(self, message):
    for chunk in self.stream_generate(message):
        yield self.create_response("stream_chunk", {
            "chunk": chunk
        })
```

### 进度反馈

对于长时间任务，定期返回进度：

```python
def process(self, data):
    total_steps = 10
    for i in range(total_steps):
        # 处理步骤
        progress = (i + 1) / total_steps * 100
        print(json.dumps({
            "type": "progress",
            "percent": progress
        }))
        sys.stdout.flush()
```

