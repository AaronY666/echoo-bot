# Services 模块说明

## IpcEvent - 统一 IPC 事件管理器

`ipcEvent` 是一个统一的 IPC 通信接口，自动适配 Electron 和浏览器环境。

### 核心特性

- ✅ **环境自适应**：自动检测 Electron/浏览器环境
- ✅ **统一接口**：前端代码无需关心底层实现
- ✅ **类型安全**：完整的 TypeScript 类型支持
- ✅ **零依赖**：不需要在前端代码中直接导入 electron

### 基本用法

```typescript
import { ipcEvent } from "@services/ipcEvent";

// 1. 发送单向事件到主进程
ipcEvent.emit("my-event", { data: "hello" });

// 2. 发送双向事件并等待响应
const result = await ipcEvent.invoke("get-data", { id: 123 });

// 3. 监听来自主进程的事件
const unsubscribe = ipcEvent.on("main-message", (data) => {
  console.log("收到主进程消息:", data);
});

// 取消监听
unsubscribe();

// 4. 一次性监听
ipcEvent.once("init-complete", () => {
  console.log("初始化完成");
});
```

### 在 React 组件中使用

```typescript
import { useEffect } from "react";
import { ipcEvent } from "@services/ipcEvent";

function MyComponent() {
  useEffect(() => {
    // 组件挂载时监听事件
    const unsubscribe = ipcEvent.on("data-update", (newData) => {
      console.log("数据更新:", newData);
      // 更新组件状态...
    });

    // 组件卸载时取消监听
    return () => {
      unsubscribe();
    };
  }, []);

  const handleClick = () => {
    // 发送事件到主进程
    ipcEvent.emit("user-action", { action: "click", target: "button" });
  };

  return <button onClick={handleClick}>点击发送事件</button>;
}
```

### 在任意地方使用

```typescript
// utils/myHelper.ts
import { ipcEvent } from "@services/ipcEvent";

export function notifyMainProcess(message: string) {
  ipcEvent.emit("notification", { message });
}

export async function fetchFromMain(query: string) {
  return await ipcEvent.invoke("search", { query });
}
```

### 主进程配置（Electron）

在主进程中继续使用 `ipcMain` 注册事件：

```javascript
// main.js
const { ipcMain } = require("electron");

// 监听单向事件
ipcMain.on("my-event", (event, data) => {
  console.log("收到前端事件:", data);
});

// 监听双向事件
ipcMain.handle("get-data", async (event, params) => {
  // 处理请求
  return { result: "some data" };
});

// 发送消息到渲染进程
mainWindow.webContents.send("main-message", { data: "hello from main" });
```

### API 文档

#### `emit(channel: string, ...args: any[]): void`
发送单向事件到主进程。

#### `invoke(channel: string, ...args: any[]): Promise<any>`
发送双向事件并等待主进程响应。

#### `on(channel: string, listener: Function): () => void`
监听来自主进程的事件，返回取消监听函数。

#### `once(channel: string, listener: Function): () => void`
一次性监听事件，触发后自动移除。

#### `removeAllListeners(channel: string): void`
移除指定频道的所有监听器。

#### `getEnvironment(): "electron" | "browser"`
获取当前运行环境。

#### `isElectronEnvironment(): boolean`
检查是否在 Electron 环境中运行。

---

## DragManager - 窗口拖拽管理器

`DragManagerRenderer` 负责处理前端的窗口拖拽逻辑，内部使用 `ipcEvent` 与主进程通信。

### 用法

```typescript
import { DragManagerRenderer } from "@services/dragManager";

const dragManager = new DragManagerRenderer();

// 在 React 组件中
dragManager.setupDragListeners(elementRef.current);

// 手动控制
dragManager.minimizeWindow();
dragManager.closeWindow();
```

### 支持的操作

- `startDrag(offsetX, offsetY)` - 开始拖拽
- `dragWindow(clientX, clientY)` - 移动窗口
- `stopDrag()` - 停止拖拽
- `minimizeWindow()` - 最小化窗口
- `closeWindow()` - 关闭窗口
- `setupDragListeners(element, ...)` - 自动设置拖拽监听

---

## 架构设计原则

1. **前端代码不直接依赖 electron**
   - 通过 `ipcEvent` 统一 IPC 接口
   - 自动处理环境差异

2. **单一职责**
   - `ipcEvent` 负责 IPC 通信
   - `dragManager` 负责拖拽逻辑
   - 各模块职责清晰

3. **可测试性**
   - 浏览器环境可以独立运行
   - 方便单元测试和开发调试

4. **类型安全**
   - 完整的 TypeScript 类型定义
   - IDE 智能提示支持

