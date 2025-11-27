/**
 * Python 进程管理器 - 在 Electron 中启动和管理 Python 子进程
 */

import { spawn, ChildProcess } from "child_process";
import path from "path";

export interface PythonProcessOptions {
  /** Python 脚本路径 */
  scriptPath: string;
  /** Python 可执行文件路径（默认为 'python3'） */
  pythonPath?: string;
  /** 脚本参数 */
  args?: string[];
  /** 工作目录 */
  cwd?: string;
}

export class PythonProcessManager {
  private process: ChildProcess | null = null;
  private scriptPath: string;
  private pythonPath: string;
  private args: string[];
  private cwd: string;
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private outputBuffer: string = ""; // 用于缓冲不完整的行
  private isReady: boolean = false; // Agent是否已就绪

  constructor(options: PythonProcessOptions) {
    this.scriptPath = options.scriptPath;
    this.pythonPath = options.pythonPath || "python3";
    this.args = options.args || [];
    this.cwd = options.cwd || process.cwd();
  }

  /**
   * 启动 Python 进程
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.process) {
        reject(new Error("Python 进程已在运行"));
        return;
      }

      console.log("🚀 启动 Python 进程:");
      console.log(`   - Python: ${this.pythonPath}`);
      console.log(`   - 脚本: ${this.scriptPath}`);
      console.log(`   - 参数: ${this.args.join(" ")}`);
      console.log(`   - 工作目录: ${this.cwd}`);

      // 启动 Python 子进程
      this.process = spawn(this.pythonPath, [this.scriptPath, ...this.args], {
        cwd: this.cwd,
        stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr
      });

      // 处理标准输出（逐行解析，支持多行和分批数据）
      this.process.stdout?.on("data", (data) => {
        // 将新数据追加到缓冲区
        this.outputBuffer += data.toString();
        
        // 按行分割
        const lines = this.outputBuffer.split("\n");
        
        // 保留最后一个不完整的行在缓冲区
        this.outputBuffer = lines.pop() || "";
        
        // 处理每一行
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue; // 跳过空行
          
          // 尝试解析 JSON
          try {
            const message = JSON.parse(trimmedLine);
            this.handleMessage(message);
          } catch (err) {
            // 非 JSON 输出，直接打印（这些应该是 stderr，但以防万一）
            console.log(`[Python] ${trimmedLine}`);
          }
        }
      });

      // 处理标准错误
      this.process.stderr?.on("data", (data) => {
        const error = data.toString().trim();
        console.error(`[Python stderr] ${error}`);
      });

      // 处理进程退出
      this.process.on("close", (code) => {
        console.log(`🛑 Python 进程已退出，退出码: ${code}`);
        
        // 处理剩余的缓冲区数据
        if (this.outputBuffer.trim()) {
          try {
            const message = JSON.parse(this.outputBuffer.trim());
            this.handleMessage(message);
          } catch (err) {
            console.log(`[Python] ${this.outputBuffer.trim()}`);
          }
        }
        
        this.outputBuffer = "";
        this.process = null;
      });

      // 处理进程错误
      this.process.on("error", (err) => {
        console.error(`❌ Python 进程错误:`, err);
        reject(err);
      });

      // 进程启动成功
      resolve();
    });
  }

  /**
   * 停止 Python 进程
   */
  stop(): void {
    if (this.process) {
      console.log("⏹️ 停止 Python 进程");
      this.process.kill();
      this.outputBuffer = ""; // 清空缓冲区
      this.isReady = false; // 重置就绪状态
      this.process = null;
    }
  }

  /**
   * 检查进程是否在运行
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * 向 Python 进程发送数据
   */
  send(data: string): void {
    if (!this.process || !this.process.stdin) {
      console.warn("⚠️ Python 进程未运行，无法发送数据");
      return;
    }

    this.process.stdin.write(data + "\n");
  }

  /**
   * 注册消息处理器,用于接收Python进程返回的消息
   */
  onMessage(type: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
    console.log(`📝 已注册 Python 消息处理器: ${type}`);
  }

  /**
   * 移除消息处理器
   */
  removeListener(type: string, handler: (data: any) => void): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(type);
      }
    }
  }

  /**
   * 发送聊天消息给 Python 进程
   */
  sendChatMessage(message: string): void {
    const payload = JSON.stringify({ type: "chat", message });
    console.log(`💬 发送聊天消息给 Python:`, message);
    this.send(payload);
  }

  /**
   * 获取聊天历史记录
   */
  async getChatHistory(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.isRunning()) {
        reject(new Error("Python 进程未运行"));
        return;
      }

      // 设置超时
      const timeout = setTimeout(() => {
        this.removeListener("chat_history", handler);
        reject(new Error("获取历史记录超时"));
      }, 5000);

      // 创建一次性处理器
      const handler = (data: any) => {
        clearTimeout(timeout);
        this.removeListener("chat_history", handler);
        resolve(data.data || []);
      };

      // 注册处理器
      this.onMessage("chat_history", handler);

      // 发送请求
      const payload = JSON.stringify({ type: "get_history" });
      console.log(`📜 请求历史记录`);
      this.send(payload);
    });
  }

  /**
   * 检查Agent是否已就绪
   */
  isAgentReady(): boolean {
    return this.isReady;
  }

  /**
   * 等待Agent就绪
   */
  waitForReady(timeout: number = 10000): Promise<void> {
    if (this.isReady) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("等待Agent就绪超时"));
      }, timeout);

      // 监听ready消息
      const handler = () => {
        clearTimeout(timer);
        this.removeListener("ready", handler);
        resolve();
      };
      this.onMessage("ready", handler);
    });
  }

  /**
   * 处理 Python 进程返回的消息
   */
  private handleMessage(message: any): void {
    // 检查是否是ready消息
    if (message.type === "ready") {
      this.isReady = true;
      console.log("✅ Python Agent 已就绪");
    }

    // 调用所有注册的处理器
    const handlers = this.messageHandlers.get(message.type);
    if (handlers && handlers.size > 0) {
      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (err) {
          console.error(`❌ 消息处理器错误 [${message.type}]:`, err);
        }
      });
    }
  }
}
