import { app, BrowserWindow } from "electron";
import path from "path";
import WindowManager from "./WindowManager";
import { PythonProcessManager } from "./PythonProcessManager";

class Application {
  private mainWindow: BrowserWindow | null = null;
  private windowManager: WindowManager | null = null;
  private pythonManager: PythonProcessManager | null = null;

  async createWindow(): Promise<void> {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    this.mainWindow = new BrowserWindow({
      width: width,
      height: height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      show: false,
      hasShadow: false,
      skipTaskbar: true, // 不显示在任务栏
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        backgroundThrottling: false,
      },
    });

    // 设置窗口可以点击穿透（除了有内容的区域）
    this.mainWindow.setIgnoreMouseEvents(true, { forward: true });

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

    // 测试：启动 Python 子进程（需要在 WindowManager 之前）
    await this.startPythonProcess();

    // 初始化窗口管理器（处理所有 IPC 通信，传入 pythonManager）
    this.windowManager = new WindowManager(this.mainWindow, this.pythonManager || undefined);
  }

  /** 启动 Python 子进程（测试） */
  async startPythonProcess(): Promise<void> {
    try {
      // 开发模式：脚本在项目根目录
      // 生产模式：脚本应该和打包后的应用在一起
      const scriptPath = app.isPackaged
        ? path.join(process.resourcesPath, "demo.py")
        : path.join(app.getAppPath(), "demo.py");
      
      console.log(`📍 Python 脚本路径: ${scriptPath}`);
      
      this.pythonManager = new PythonProcessManager({
        scriptPath,
        pythonPath: "python3", // macOS/Linux 通常用 python3
        args: [],
      });

      await this.pythonManager.start();
      console.log("✅ Python 进程启动成功");
    } catch (err) {
      console.error("❌ Python 进程启动失败:", err);
      console.error("提示: 请确保系统已安装 Python 3，并且 'python3' 命令可用");
    }
  }

  cleanup(): void {
    if (this.windowManager) {
      this.windowManager.cleanup();
    }

    // 停止 Python 进程
    if (this.pythonManager) {
      this.pythonManager.stop();
      this.pythonManager = null;
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

