import { app, BrowserWindow } from "electron";
import path from "path";
import WindowManager from "./WindowManager";

class Application {
  private mainWindow: BrowserWindow | null = null;
  private windowManager: WindowManager | null = null;

  createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 300,
      height: 300,
      x: 100,
      y: 100,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      show: false,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        backgroundThrottling: false,
      },
    });

    // 开发模式：加载Vite开发服务器
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      this.mainWindow.loadURL('http://localhost:5173');
    } else {
      // 生产模式：加载构建后的文件
      const htmlPath = path.join(__dirname, "dist/index.html");
      this.mainWindow.loadFile(htmlPath);
    }

    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow?.show();
      this.mainWindow?.focus();
    });

    // 根据环境变量决定是否打开调试工具
    if (process.env.DEBUG === 'true') {
      console.log("🔧 开发者工具已启用");
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // 初始化窗口管理器（处理所有 IPC 通信）
    this.windowManager = new WindowManager(this.mainWindow);
  }

  cleanup(): void {
    if (this.windowManager) {
      this.windowManager.cleanup();
    }
  }
}

app.whenReady().then(() => {
  const application = new Application();
  application.createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      application.createWindow();
    }
  });

  app.on("before-quit", () => {
    application.cleanup();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

