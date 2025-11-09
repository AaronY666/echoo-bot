const { DragManagerMain } = require("./src/services/dragManager");
const { ipcMain, screen, app } = require("electron/main");

/**
 * 窗口管理器 - 处理所有窗口相关的 IPC 通信
 * 使用 DragManager 统一管理拖拽逻辑
 */
class WindowManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    // 传入 ipcMain, screen 和 app 实例
    this.dragManager = new DragManagerMain(mainWindow, ipcMain, screen, app);
    this.setupIPC();
  }

  /**
   * 设置所有 IPC 监听器
   */
  setupIPC() {
    // 使用 DragManager 设置所有监听器
    this.dragManager.setupListeners();
  }

  /**
   * 清理所有监听器
   */
  cleanup() {
    this.dragManager.cleanup();
  }
}

module.exports = WindowManager;

