import { ipcMain, app } from "electron/main";
import type { BrowserWindow } from "electron/main";

/**
 * 窗口管理器 - 处理窗口相关的 IPC 通信
 * 拖拽已在前端实现，这里只处理窗口控制和鼠标穿透
 */
class WindowManager {
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupIPC();
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

    console.log("✅ WindowManager IPC 监听器已设置");
  }

  /**
   * 清理所有监听器
   */
  cleanup(): void {
    ipcMain.removeAllListeners("minimize-window");
    ipcMain.removeAllListeners("close-window");
    ipcMain.removeAllListeners("set-ignore-mouse-events");
    console.log("🧹 WindowManager 监听器已清理");
  }
}

export default WindowManager;

