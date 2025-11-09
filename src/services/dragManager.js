/**
 * 拖拽管理器 - 统一管理拖拽相关的 IPC 通信
 * 可同时用于渲染进程和主进程
 */

// ========== 事件名枚举 ==========
const DragEvents = {
  DRAG_WINDOW: "drag-window",
  STOP_DRAG: "stop-drag",
  MINIMIZE_WINDOW: "minimize-window",
  CLOSE_WINDOW: "close-window",
};

// ========== 渲染进程端（React 使用） ==========
class DragManagerRenderer {
  constructor() {
    this.ipcRenderer = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isDragging = false;

    // 初始化 ipcRenderer（只在渲染进程中有效）
    if (typeof window !== "undefined" && window.require) {
      this.ipcRenderer = window.require("electron").ipcRenderer;
    }
  }

  /**
   * 开始拖拽 - 保存鼠标偏移量
   */
  startDrag(offsetX, offsetY) {
    this.isDragging = true;
    this.dragOffset = { x: offsetX, y: offsetY };
    console.log("💾 开始拖拽，保存偏移量:", this.dragOffset);
  }

  /**
   * 拖动窗口
   */
  dragWindow(clientX, clientY) {
    if (!this.ipcRenderer) {
      console.warn("⚠️ ipcRenderer 不可用");
      return;
    }
    if (!this.isDragging) {
      console.warn("⚠️ 未处于拖拽状态");
      return;
    }

    this.ipcRenderer.send(DragEvents.DRAG_WINDOW, {
      clientX,
      clientY,
      offsetX: this.dragOffset.x,
      offsetY: this.dragOffset.y,
    });
  }

  /**
   * 停止拖拽
   */
  stopDrag() {
    if (!this.ipcRenderer) return;

    this.isDragging = false;
    this.ipcRenderer.send(DragEvents.STOP_DRAG);
    console.log("🖱️ 拖拽结束");
  }

  /**
   * 最小化窗口
   */
  minimizeWindow() {
    if (!this.ipcRenderer) return;
    this.ipcRenderer.send(DragEvents.MINIMIZE_WINDOW);
  }

  /**
   * 关闭窗口
   */
  closeWindow() {
    if (!this.ipcRenderer) return;
    this.ipcRenderer.send(DragEvents.CLOSE_WINDOW);
  }

  /**
   * 设置拖拽事件监听（用于 React 组件）
   */
  setupDragListeners(element, onDragStart, onDragging, onDragEnd) {
    if (!element) return;

    const handleMouseDown = (e) => {
      e.preventDefault();
      
      const rect = element.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      this.startDrag(offsetX, offsetY);
      if (onDragStart) onDragStart();

      const handleMouseMove = (moveEvent) => {
        this.dragWindow(moveEvent.clientX, moveEvent.clientY);
        if (onDragging) onDragging();
      };

      const handleMouseUp = () => {
        this.stopDrag();
        if (onDragEnd) onDragEnd();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    element.addEventListener("mousedown", handleMouseDown);

    // 返回清理函数
    return () => {
      element.removeEventListener("mousedown", handleMouseDown);
    };
  }
}

// ========== 主进程端（Electron Main 使用） ==========
class DragManagerMain {
  constructor(mainWindow, ipcMain, screen, app) {
    this.mainWindow = mainWindow;
    this.ipcMain = ipcMain;
    this.screen = screen;
    this.app = app;

    console.log("🔧 DragManagerMain 初始化", {
      hasMainWindow: !!this.mainWindow,
      hasIpcMain: !!this.ipcMain,
      hasScreen: !!this.screen,
      hasApp: !!this.app,
    });
  }

  /**
   * 设置所有 IPC 监听器
   */
  setupListeners() {
    if (!this.ipcMain) return;

    // 拖动窗口
    this.ipcMain.on(
      DragEvents.DRAG_WINDOW,
      (event, { clientX, clientY, offsetX, offsetY }) => {
        this.handleDragWindow(offsetX, offsetY);
      }
    );

    // 停止拖拽
    this.ipcMain.on(DragEvents.STOP_DRAG, () => {
      this.handleStopDrag();
    });

    // 最小化窗口
    this.ipcMain.on(DragEvents.MINIMIZE_WINDOW, () => {
      this.handleMinimize();
    });

    // 关闭窗口
    this.ipcMain.on(DragEvents.CLOSE_WINDOW, () => {
      this.handleClose();
    });

    console.log("✅ DragManager 主进程监听器已设置");
  }

  /**
   * 处理窗口拖动
   */
  handleDragWindow(offsetX, offsetY) {
    if (!this.mainWindow || !this.screen) {
      console.error("❌ mainWindow 或 screen 不可用");
      return;
    }

    const { x, y } = this.screen.getCursorScreenPoint();
    const newX = x - offsetX;
    const newY = y - offsetY;

    this.mainWindow.setPosition(Math.round(newX), Math.round(newY));
  }

  /**
   * 处理拖拽结束
   */
  handleStopDrag() {
    // 可以在这里添加拖拽结束后的逻辑
    // 例如：保存窗口位置
  }

  /**
   * 处理窗口最小化
   */
  handleMinimize() {
    if (!this.mainWindow) return;
    this.mainWindow.minimize();
  }

  /**
   * 处理窗口关闭
   */
  handleClose() {
    if (!this.app) return;
    this.app.quit();
  }

  /**
   * 清理所有监听器
   */
  cleanup() {
    if (!this.ipcMain) return;

    this.ipcMain.removeAllListeners(DragEvents.DRAG_WINDOW);
    this.ipcMain.removeAllListeners(DragEvents.STOP_DRAG);
    this.ipcMain.removeAllListeners(DragEvents.MINIMIZE_WINDOW);
    this.ipcMain.removeAllListeners(DragEvents.CLOSE_WINDOW);

    console.log("🧹 DragManager 监听器已清理");
  }
}

// ========== 导出 ==========
// CommonJS 导出（用于 Electron 主进程）
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DragEvents,
    DragManagerRenderer,
    DragManagerMain,
  };
}

// ES6 导出（用于 React）
export { DragEvents, DragManagerRenderer, DragManagerMain };
