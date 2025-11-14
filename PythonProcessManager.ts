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
  private messageHandlers: Map<string, (data: any) => void> = new Map();

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

      // 处理标准输出
      this.process.stdout?.on("data", (data) => {
        const output = data.toString().trim();
        console.log(`[Python stdout] ${output}`);

        // 尝试解析 JSON 消息
        try {
          const message = JSON.parse(output);
          this.handleMessage(message);
        } catch (err) {
          // 非 JSON 输出，直接打印
          console.log(`[Python] ${output}`);
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
   * 注册消息处理器
   */
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
    console.log(`📝 已注册 Python 消息处理器: ${type}`);
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
   * 处理 Python 进程返回的消息
   */
  private handleMessage(message: any): void {
    // 先尝试调用注册的处理器
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        handler(message);
        return;
      } catch (err) {
        console.error(`❌ 消息处理器错误 [${message.type}]:`, err);
      }
    }

    // 默认处理器（向后兼容）
    switch (message.type) {
      case "progress":
        console.log(
          `📊 进度: ${message.step}/${message.total} - ${message.message}`
        );
        break;

      case "complete":
        console.log(`✅ 完成: ${message.data.message}`);
        break;

      case "error":
        console.error(`❌ 错误: ${message.message}`);
        break;

      default:
        console.log(`📨 消息:`, message);
    }
  }
}

