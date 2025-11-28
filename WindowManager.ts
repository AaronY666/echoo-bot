import { ipcMain, app } from "electron/main";
import type { BrowserWindow } from "electron/main";
import type { PythonProcessManager } from "./PythonProcessManager";

/**
 * 窗口管理器 - 处理窗口相关的 IPC 通信
 * 拖拽已在前端实现，这里只处理窗口控制和鼠标穿透
 */
class WindowManager {
  private mainWindow: BrowserWindow;
  private pythonManager: PythonProcessManager | null;

  constructor(mainWindow: BrowserWindow, pythonManager?: PythonProcessManager) {
    this.mainWindow = mainWindow;
    this.pythonManager = pythonManager || null;
    this.setupIPC();
    this.setupPythonHandlers();
  }

  /**
   * 设置所有 IPC 监听器
   */
  setupIPC(): void {
    // 窗口控制
    ipcMain.on("minimize-window", () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.minimize();
      }
    });

    ipcMain.on("close-window", () => {
      app.quit();
    });

    // 鼠标穿透控制（必需，否则全屏窗口会拦截所有点击）
    ipcMain.on(
      "set-ignore-mouse-events",
      (_event, ignore: boolean, options?: { forward: boolean }) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.setIgnoreMouseEvents(ignore, options);
        }
      }
    );

    //--------------  聊天相关 IPC  --------------
    // 接收前端的聊天消息，转发给 Python 进程
    ipcMain.on("send-chat-message", (_event, message: string) => {
      console.log(`💬 收到前端聊天消息:`, message);
      if (this.pythonManager) {
        this.pythonManager.sendChatMessage(message);
      } else {
        console.warn("⚠️ Python 进程未启动，无法发送消息");
      }
    });

    // 获取聊天历史记录
    ipcMain.handle("get-chat-history", async () => {
      console.log(`📜 收到获取历史记录请求`);
      if (this.pythonManager) {
        try {
          // 等待Agent就绪（最多10秒）
          if (!this.pythonManager.isAgentReady()) {
            console.log("⏳ 等待 Python Agent 初始化完成...");
            await this.pythonManager.waitForReady(10000);
          }
          
          const history = await this.pythonManager.getChatHistory();
          console.log(`✅ 成功获取 ${history.length} 条历史记录`);
          return history;
        } catch (err) {
          console.error("❌ 获取历史记录失败:", err);
          return [];
        }
      } else {
        console.warn("⚠️ Python 进程未启动，无法获取历史记录");
        return [];
      }
    });

    //--------------  MCP Server 管理相关 IPC  --------------

    // 获取所有 MCP Server 状态
    ipcMain.handle("get-mcp-servers", async () => {
      console.log(`📡 收到获取 MCP Server 列表请求`);
      if (this.pythonManager) {
        try {
          if (!this.pythonManager.isAgentReady()) {
            console.log("⏳ 等待 Python Agent 初始化完成...");
            await this.pythonManager.waitForReady(10000);
          }
          const servers = await this.pythonManager.getMCPServers();
          console.log(`✅ 成功获取 MCP Server 列表`);
          return servers;
        } catch (err) {
          console.error("❌ 获取 MCP Server 列表失败:", err);
          return {};
        }
      } else {
        console.warn("⚠️ Python 进程未启动");
        return {};
      }
    });

    // Toggle MCP Server 状态
    ipcMain.handle("toggle-mcp-server", async (_event, name: string, enabled: boolean) => {
      console.log(`🔄 收到 Toggle MCP Server 请求: ${name} -> ${enabled}`);
      if (this.pythonManager) {
        try {
          const success = await this.pythonManager.toggleMCPServer(name, enabled);
          console.log(`${success ? '✅' : '❌'} Toggle MCP Server ${name}: ${success}`);
          return success;
        } catch (err) {
          console.error("❌ Toggle MCP Server 失败:", err);
          return false;
        }
      } else {
        console.warn("⚠️ Python 进程未启动");
        return false;
      }
    });

    // 添加新的 MCP Server
    ipcMain.handle("add-mcp-server", async (_event, config: { name: string; url: string; description?: string; auth?: any }) => {
      console.log(`➕ 收到添加 MCP Server 请求: ${config.name}`);
      if (this.pythonManager) {
        try {
          const success = await this.pythonManager.addMCPServer(
            config.name,
            config.url,
            config.description,
            config.auth
          );
          console.log(`${success ? '✅' : '❌'} 添加 MCP Server ${config.name}: ${success}`);
          return success;
        } catch (err) {
          console.error("❌ 添加 MCP Server 失败:", err);
          return false;
        }
      } else {
        console.warn("⚠️ Python 进程未启动");
        return false;
      }
    });

    // 更新 MCP Server 配置
    ipcMain.handle("update-mcp-server", async (_event, config: { name: string; url?: string; description?: string; auth?: any }) => {
      console.log(`✏️ 收到更新 MCP Server 请求: ${config.name}`);
      if (this.pythonManager) {
        try {
          const success = await this.pythonManager.updateMCPServer(
            config.name,
            config.url,
            config.description,
            config.auth
          );
          console.log(`${success ? '✅' : '❌'} 更新 MCP Server ${config.name}: ${success}`);
          return success;
        } catch (err) {
          console.error("❌ 更新 MCP Server 失败:", err);
          return false;
        }
      } else {
        console.warn("⚠️ Python 进程未启动");
        return false;
      }
    });

    // 删除 MCP Server
    ipcMain.handle("remove-mcp-server", async (_event, name: string) => {
      console.log(`🗑️ 收到删除 MCP Server 请求: ${name}`);
      if (this.pythonManager) {
        try {
          const success = await this.pythonManager.removeMCPServer(name);
          console.log(`${success ? '✅' : '❌'} 删除 MCP Server ${name}: ${success}`);
          return success;
        } catch (err) {
          console.error("❌ 删除 MCP Server 失败:", err);
          return false;
        }
      } else {
        console.warn("⚠️ Python 进程未启动");
        return false;
      }
    });

    // 刷新所有 MCP Server
    ipcMain.handle("reload-mcp-servers", async () => {
      console.log(`🔄 收到刷新所有 MCP Server 请求`);
      if (this.pythonManager) {
        try {
          const success = await this.pythonManager.reloadMCPServers();
          console.log(`${success ? '✅' : '❌'} 刷新 MCP Server: ${success}`);
          return success;
        } catch (err) {
          console.error("❌ 刷新 MCP Server 失败:", err);
          return false;
        }
      } else {
        console.warn("⚠️ Python 进程未启动");
        return false;
      }
    });

    console.log("✅ WindowManager IPC 监听器已设置");
  }

  /**
   * 设置 Python 消息处理器
   */
  setupPythonHandlers(): void {
    if (!this.pythonManager) {
      console.log("ℹ️ 未提供 Python 进程管理器，跳过消息处理器设置");
      return;
    }

    // 监听 Python 的聊天响应，转发给前端
    this.pythonManager.onMessage("chat_response", (data: any) => {
      console.log(`🤖 收到 Python 聊天响应:`, data.message);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("chat-response", data);
      }
    });

    console.log("✅ Python 消息处理器已设置");
  }

  /**
   * 清理所有监听器
   */
  cleanup(): void {
    ipcMain.removeAllListeners("minimize-window");
    ipcMain.removeAllListeners("close-window");
    ipcMain.removeAllListeners("set-ignore-mouse-events");
    ipcMain.removeAllListeners("send-chat-message");
    ipcMain.removeHandler("get-chat-history");
    
    // 清理 MCP 相关的处理器
    ipcMain.removeHandler("get-mcp-servers");
    ipcMain.removeHandler("toggle-mcp-server");
    ipcMain.removeHandler("add-mcp-server");
    ipcMain.removeHandler("update-mcp-server");
    ipcMain.removeHandler("remove-mcp-server");
    ipcMain.removeHandler("reload-mcp-servers");
    
    console.log("🧹 WindowManager 监听器已清理");
  }
}

export default WindowManager;

