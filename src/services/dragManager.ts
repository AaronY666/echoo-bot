/**
 * 拖拽管理器 - 统一管理拖拽相关的 IPC 通信
 * 可同时用于渲染进程和主进程
 */

import type { BrowserWindow, IpcMain, Screen, App } from "electron/main";
import { ipcEvent } from "./ipcEvent";

//--------------  事件名枚举  --------------

export const DragEvents = {
  DRAG_WINDOW: "drag-window",
  STOP_DRAG: "stop-drag",
  MINIMIZE_WINDOW: "minimize-window",
  CLOSE_WINDOW: "close-window",
} as const;

//--------------  类型定义  --------------

interface DragOffset {
  x: number;
  y: number;
}

interface DragWindowData {
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
}

//--------------  渲染进程端（React 使用）  --------------

export class DragManagerRenderer {
  private dragOffset: DragOffset = { x: 0, y: 0 };
  private isDragging: boolean = false;

  /**
   * 开始拖拽 - 保存鼠标偏移量
   */
  startDrag(offsetX: number, offsetY: number): void {
    this.isDragging = true;
    this.dragOffset = { x: offsetX, y: offsetY };
    console.log("💾 开始拖拽，保存偏移量:", this.dragOffset);
  }

  /**
   * 拖动窗口
   */
  dragWindow(clientX: number, clientY: number): void {
    if (!this.isDragging) {
      console.warn("⚠️ 未处于拖拽状态");
      return;
    }

    ipcEvent.emit(DragEvents.DRAG_WINDOW, {
      clientX,
      clientY,
      offsetX: this.dragOffset.x,
      offsetY: this.dragOffset.y,
    });
  }

  /**
   * 停止拖拽
   */
  stopDrag(): void {
    this.isDragging = false;
    ipcEvent.emit(DragEvents.STOP_DRAG);
    console.log("🖱️ 拖拽结束");
  }

  /**
   * 最小化窗口
   */
  minimizeWindow(): void {
    ipcEvent.emit(DragEvents.MINIMIZE_WINDOW);
  }

  /**
   * 关闭窗口
   */
  closeWindow(): void {
    ipcEvent.emit(DragEvents.CLOSE_WINDOW);
  }

  /**
   * 设置拖拽事件监听（用于 React 组件）
   */
  setupDragListeners(
    element: HTMLElement,
    onDragStart?: () => void,
    onDragging?: () => void,
    onDragEnd?: () => void
  ): () => void {
    if (!element) return () => {};

    const handleMouseDown = (e: MouseEvent): void => {
      e.preventDefault();

      const rect = element.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      this.startDrag(offsetX, offsetY);
      if (onDragStart) onDragStart();

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        this.dragWindow(moveEvent.clientX, moveEvent.clientY);
        if (onDragging) onDragging();
      };

      const handleMouseUp = (): void => {
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

//--------------  主进程端（Electron Main 使用）  --------------

export class DragManagerMain {
  private mainWindow: BrowserWindow;
  private ipcMain: IpcMain;
  private screen: Screen;
  private app: App;

  constructor(
    mainWindow: BrowserWindow,
    ipcMain: IpcMain,
    screen: Screen,
    app: App
  ) {
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
  setupListeners(): void {
    if (!this.ipcMain) return;

    // 拖动窗口
    this.ipcMain.on(
      DragEvents.DRAG_WINDOW,
      (_event, { clientX, clientY, offsetX, offsetY }: DragWindowData) => {
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
  private handleDragWindow(offsetX: number, offsetY: number): void {
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
  private handleStopDrag(): void {
    // 可以在这里添加拖拽结束后的逻辑
    // 例如：保存窗口位置
  }

  /**
   * 处理窗口最小化
   */
  private handleMinimize(): void {
    if (!this.mainWindow) return;
    this.mainWindow.minimize();
  }

  /**
   * 处理窗口关闭
   */
  private handleClose(): void {
    if (!this.app) return;
    this.app.quit();
  }

  /**
   * 清理所有监听器
   */
  cleanup(): void {
    if (!this.ipcMain) return;

    this.ipcMain.removeAllListeners(DragEvents.DRAG_WINDOW);
    this.ipcMain.removeAllListeners(DragEvents.STOP_DRAG);
    this.ipcMain.removeAllListeners(DragEvents.MINIMIZE_WINDOW);
    this.ipcMain.removeAllListeners(DragEvents.CLOSE_WINDOW);

    console.log("🧹 DragManager 监听器已清理");
  }
}

//--------------  导出  --------------

// CommonJS 导出（用于 Electron 主进程）
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DragEvents,
    DragManagerRenderer,
    DragManagerMain,
  };
}
