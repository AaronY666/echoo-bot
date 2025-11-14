/**
 * IPC 事件管理器 - 统一的前端 IPC 通信接口
 * 在 Electron 环境中自动桥接到 ipcRenderer
 * 在浏览器环境中提供本地事件模拟
 */

import type { IpcRenderer, IpcRendererEvent } from "electron";

type EventListener = (...args: any[]) => void;

/**
 * IPC 事件管理器类 - 提供统一的 IPC 通信接口
 */
class IpcEvent {
  private ipcRenderer: IpcRenderer | null = null;
  private localListeners: Map<string, Set<EventListener>> = new Map();
  private isElectron: boolean = false;

  constructor() {
    this.initialize();
  }

  /** 初始化 - 检测运行环境并获取 ipcRenderer */
  private initialize(): void {
    // 尝试获取 ipcRenderer
    if (typeof window !== "undefined" && (window as any).require) {
      try {
        this.ipcRenderer = (window as any).require("electron").ipcRenderer;
        this.isElectron = true;
        console.log("✅ IpcEvent: 运行在 Electron 环境");
      } catch (err) {
        console.warn("⚠️ IpcEvent: 无法获取 ipcRenderer");
      }
    }

    if (!this.isElectron) {
      console.log("ℹ️ IpcEvent: 运行在浏览器环境，使用本地事件模拟");
    }
  }

  /**
   * 发送事件到主进程（单向）
   */
  emit(channel: string, ...args: any[]): void {
    if (this.isElectron && this.ipcRenderer) {
      // Electron 环境：发送到主进程
      this.ipcRenderer.send(channel, ...args);
    } else {
      // 浏览器环境：触发本地监听器
      const listeners = this.localListeners.get(channel);
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            listener(...args);
          } catch (err) {
            console.error(`IpcEvent 本地监听器错误 [${channel}]:`, err);
          }
        });
      }
    }
  }

  /**
   * 发送事件并等待主进程响应（双向）
   */
  async invoke(channel: string, ...args: any[]): Promise<any> {
    if (this.isElectron && this.ipcRenderer) {
      // Electron 环境：调用主进程并等待返回
      console.log(`🔄 IpcEvent.invoke: ${channel}`, ...args);
      const result = await this.ipcRenderer.invoke(channel, ...args);
      console.log(`✅ IpcEvent.invoke 返回: ${channel}`, result);
      return result;
    } else {
      // 浏览器环境：返回 mock 数据
      console.warn(`⚠️ IpcEvent.invoke (mock): ${channel}`, ...args);
      return Promise.resolve(null);
    }
  }

  /**
   * 监听来自主进程的事件
   */
  on(channel: string, listener: EventListener): () => void {
    if (this.isElectron && this.ipcRenderer) {
      // Electron 环境：监听主进程消息
      const wrappedListener = (_event: IpcRendererEvent, ...args: any[]) => {
        listener(...args);
      };
      this.ipcRenderer.on(channel, wrappedListener);
      console.log(`👂 IpcEvent.on: ${channel}`);

      // 返回取消监听函数
      return () => {
        if (this.ipcRenderer) {
          this.ipcRenderer.removeListener(channel, wrappedListener);
          console.log(`🔇 IpcEvent.off: ${channel}`);
        }
      };
    } else {
      // 浏览器环境：本地事件监听
      if (!this.localListeners.has(channel)) {
        this.localListeners.set(channel, new Set());
      }
      this.localListeners.get(channel)!.add(listener);
      console.log(`👂 IpcEvent.on (local): ${channel}`);

      // 返回取消监听函数
      return () => {
        const listeners = this.localListeners.get(channel);
        if (listeners) {
          listeners.delete(listener);
          if (listeners.size === 0) {
            this.localListeners.delete(channel);
          }
        }
        console.log(`🔇 IpcEvent.off (local): ${channel}`);
      };
    }
  }

  /**
   * 监听一次性事件
   */
  once(channel: string, listener: EventListener): () => void {
    if (this.isElectron && this.ipcRenderer) {
      // Electron 环境
      const wrappedListener = (_event: IpcRendererEvent, ...args: any[]) => {
        listener(...args);
      };
      this.ipcRenderer.once(channel, wrappedListener);
      console.log(`👂 IpcEvent.once: ${channel}`);

      return () => {
        if (this.ipcRenderer) {
          this.ipcRenderer.removeListener(channel, wrappedListener);
        }
      };
    } else {
      // 浏览器环境：包装成一次性监听
      const onceListener = (...args: any[]) => {
        listener(...args);
        const listeners = this.localListeners.get(channel);
        if (listeners) {
          listeners.delete(onceListener);
        }
      };

      if (!this.localListeners.has(channel)) {
        this.localListeners.set(channel, new Set());
      }
      this.localListeners.get(channel)!.add(onceListener);
      console.log(`👂 IpcEvent.once (local): ${channel}`);

      return () => {
        const listeners = this.localListeners.get(channel);
        if (listeners) {
          listeners.delete(onceListener);
        }
      };
    }
  }

  /**
   * 移除指定频道的所有监听器
   */
  removeAllListeners(channel: string): void {
    if (this.isElectron && this.ipcRenderer) {
      this.ipcRenderer.removeAllListeners(channel);
    } else {
      this.localListeners.delete(channel);
    }
    console.log(`🗑️ IpcEvent.removeAllListeners: ${channel}`);
  }

  /**
   * 获取运行环境
   */
  getEnvironment(): "electron" | "browser" {
    return this.isElectron ? "electron" : "browser";
  }

  /**
   * 检查是否在 Electron 环境
   */
  isElectronEnvironment(): boolean {
    return this.isElectron;
  }
}

// 导出单例实例
export const ipcEvent = new IpcEvent();

// 也导出类型，方便在其他地方使用
export type { EventListener };
