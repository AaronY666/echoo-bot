# MCP (Model Context Protocol) 集成指南

## 概述

echoo-bot 已集成 MCP 支持，允许 agent 调用外部工具和服务。基于 `langchain-mcp-adapters` 实现，支持动态添加/移除 MCP Server（热插拔）。

---

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

新增的依赖：
- `langchain-mcp-adapters>=0.1.0`
- `httpx>=0.24.0`

### 2. 配置环境变量

在 `.env` 文件中添加：

```bash
# 启用 MCP 功能
ENABLE_MCP=true

# MCP 配置文件路径（可选，默认为 ./mcp_servers.json）
MCP_SERVERS_CONFIG=./mcp_servers.json

# 调试模式（可选）
DEBUG_MCP=true

# MCP 认证令牌（如果需要）
MCP_ONLINE_TOKEN=your_token_here
```

### 3. 配置 MCP Server

编辑 `mcp_servers.json`：

```json
[
  {
    "name": "browser",
    "url": "http://localhost:3001/mcp",
    "description": "浏览器控制工具",
    "enabled": true,
    "auth": null
  },
  {
    "name": "online_tool",
    "url": "https://api.example.com/mcp",
    "description": "在线工具",
    "enabled": true,
    "auth": {
      "type": "bearer",
      "token": "${MCP_ONLINE_TOKEN}"
    }
  }
]
```

**配置说明：**
- `name`: Server 名称（唯一标识）
- `url`: Server URL
- `description`: 描述
- `enabled`: 是否启用
- `auth`: 认证配置（可选）
  - `type`: 认证类型（`bearer` 或 `api_key`）
  - `token`/`key`: 认证令牌（支持 `${ENV_VAR}` 格式）

### 4. 运行

```bash
python agent.py
```

---

## 使用方式

### 对话方式调用 MCP 工具

用户直接与 agent 对话，agent 会自动识别是否需要调用 MCP 工具：

```
用户: "帮我打开浏览器并搜索今天的天气"
  ↓
Router 识别为 mcp_tool 类型
  ↓
mcp_tool_node 选择合适的工具并调用
  ↓
chat_node 合成友好的回复
```

### 前端 TypeScript 管理 MCP

通过发送消息到 Python 进程：

#### 1. 列出所有 MCP Server

```typescript
pythonProcess.send({
  type: "mcp_list_servers"
});

// 响应：
{
  type: "mcp_servers_list",
  data: {
    "browser": {
      "name": "browser",
      "url": "http://localhost:3001/mcp",
      "connected": true,
      "tools_count": 5,
      "last_error": null
    },
    ...
  }
}
```

#### 2. 列出所有可用工具

```typescript
pythonProcess.send({
  type: "mcp_list_tools"
});

// 响应：
{
  type: "mcp_tools_list",
  data: [
    {
      "id": "browser.open",
      "server_name": "browser",
      "tool_name": "open",
      "description": "打开浏览器",
      "parameters": {...},
      "enabled": true
    },
    ...
  ]
}
```

#### 3. 动态添加 MCP Server

```typescript
pythonProcess.send({
  type: "mcp_add_server",
  name: "new_tool",
  url: "http://localhost:3003/mcp",
  description: "新工具",
  auth: {
    type: "bearer",
    token: "your_token"
  }
});

// 响应：
{
  type: "mcp_server_added",
  success: true,
  name: "new_tool"
}
```

#### 4. 移除 MCP Server

```typescript
pythonProcess.send({
  type: "mcp_remove_server",
  name: "new_tool"
});

// 响应：
{
  type: "mcp_server_removed",
  success: true,
  name: "new_tool"
}
```

#### 5. 重新加载所有 MCP Server

```typescript
pythonProcess.send({
  type: "mcp_reload"
});

// 响应：
{
  type: "mcp_reloaded",
  success: true
}
```

---

## 工作流程

```
用户输入
  ↓
router_node (LLM 分析意图)
  ├─ workflow_type: "chat" → chat_node
  ├─ workflow_type: "image" → image_node
  ├─ workflow_type: "video" → video_node
  └─ workflow_type: "mcp_tool" → mcp_tool_node
                                   ↓
                                 选择工具 (LLM)
                                   ↓
                                 调用工具
                                   ↓
                                 chat_node (合成回复)
                                   ↓
                                 返回用户
```

---

## 架构设计

### 模块结构

```
agent/
  ├─ mcp/                      # MCP 相关模块
  │   ├─ __init__.py
  │   ├─ client.py             # MCP 客户端封装
  │   ├─ manager.py            # MCP Server 管理器（热插拔）
  │   ├─ registry.py           # 工具注册表
  │   ├─ config.py             # 配置管理
  │   └─ schemas.py            # 数据结构定义
  │
  ├─ nodes/
  │   ├─ mcp_tool_node.py      # MCP 工具节点
  │   └─ ...
  │
  └─ langgraph_agent.py        # 工作流编排
```

### 关键特性

1. **热插拔**：无需重启 agent，动态添加/移除 MCP Server
2. **自动工具选择**：LLM 自动分析用户意图，选择合适的工具
3. **认证支持**：支持 Bearer Token、API Key 等认证方式
4. **环境变量替换**：配置文件中的 `${VAR}` 会自动替换为环境变量
5. **工具注册表**：统一管理所有 MCP 工具，支持搜索和查询
6. **状态监控**：实时查看 MCP Server 连接状态和工具数量

---

## 开发自己的 MCP Server

### MCP Server 示例

你可以参考以下资源创建自己的 MCP Server：

1. **官方文档**: https://modelcontextprotocol.io
2. **示例项目**: https://github.com/anthropics/mcp-examples

### 基本要求

MCP Server 需要提供以下端点（HTTP 传输方式）：

```
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

响应：

```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "tool_name",
        "description": "工具描述",
        "inputSchema": {
          "type": "object",
          "properties": {...}
        }
      }
    ]
  },
  "id": 1
}
```

---

## 故障排查

### 问题 1：MCP Manager 未初始化

**错误信息**: `MCP Manager 未初始化`

**解决方案**:
1. 检查 `.env` 中 `ENABLE_MCP=true`
2. 检查 `mcp_servers.json` 是否存在且格式正确
3. 查看日志确认是否有加载错误

### 问题 2：无法连接 MCP Server

**错误信息**: `MCP 客户端初始化失败`

**解决方案**:
1. 确认 MCP Server 正在运行
2. 检查 URL 是否正确
3. 检查认证信息是否正确
4. 设置 `DEBUG_MCP=true` 查看详细日志

### 问题 3：工具调用失败

**错误信息**: `工具 'xxx' 不存在`

**解决方案**:
1. 使用 `mcp_list_tools` 查看可用工具列表
2. 检查工具名称是否正确
3. 重新加载 MCP Server: `mcp_reload`

---

## 示例场景

### 场景 1：浏览器控制

```
用户: "帮我打开浏览器并搜索 LangGraph 教程"

工作流：
1. router_node 识别为 mcp_tool
2. mcp_tool_node 选择 browser.open 工具
3. 调用工具：{"url": "https://www.google.com/search?q=LangGraph+教程"}
4. chat_node 合成回复："已为您打开浏览器并搜索 LangGraph 教程"
```

### 场景 2：文件操作

```
用户: "读取 config.json 文件的内容"

工作流：
1. router_node 识别为 mcp_tool
2. mcp_tool_node 选择 filesystem.read 工具
3. 调用工具：{"path": "config.json"}
4. chat_node 合成回复："config.json 的内容是：..."
```

---

## 最佳实践

1. **按需启用**：只启用需要的 MCP Server，避免工具列表过长
2. **清晰命名**：给 Server 和工具起清晰的名称，便于 LLM 选择
3. **详细描述**：提供详细的工具描述，帮助 LLM 理解工具用途
4. **安全认证**：使用环境变量管理认证令牌，不要硬编码
5. **定期重载**：如果 MCP Server 更新了工具，使用 `mcp_reload` 刷新

---

## 未来扩展

- [ ] 支持 stdio 传输方式（本地进程）
- [ ] 支持 SSE 传输方式（Server-Sent Events）
- [ ] 支持 MCP Resources（资源访问）
- [ ] 支持 MCP Prompts（提示词模板）
- [ ] 工具调用历史记录
- [ ] 工具调用统计和分析
- [ ] 前端 UI 可视化管理界面

---

## 参考资料

- [Model Context Protocol 官方文档](https://modelcontextprotocol.io)
- [langchain-mcp-adapters GitHub](https://github.com/langchain-ai/langchain-mcp-adapters)
- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)

