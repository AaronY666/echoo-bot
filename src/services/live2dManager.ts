/**
 * Live2D 管理器 - 封装 Live2D 模型的加载、交互、动画等逻辑
 */

import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";

/** Live2D 管理器配置 */
export interface Live2DManagerConfig {
  /** Canvas 容器元素 */
  container: HTMLElement;
  /** 画布宽度 */
  width?: number;
  /** 画布高度 */
  height?: number;
  /** 模型缩放比例 */
  scale?: number;
  /** 模型 URL 列表 */
  modelUrls?: string[];
}

/** Live2D 管理器 */
export class Live2DManager {
  private app: PIXI.Application | null = null;
  private model: Live2DModel | null = null;
  private config: Required<Live2DManagerConfig>;
  private idleAnimationTimer: NodeJS.Timeout | null = null;
  private currentMotion: string = "";
  private currentExpression: string = "";
  private isSpeaking: boolean = false;
  private motions: string[] = [];
  private expressions: string[] = [];
  private isInteractionEnabled: boolean = true;
  private clickTimer: NodeJS.Timeout | null = null; // 点击延时计时器
  private canvas: HTMLCanvasElement | null = null; // PIXI 创建的 canvas

  //--------------  生命周期  --------------

  constructor(config: Live2DManagerConfig) {
    this.config = {
      container: config.container,
      width: config.width || 300,
      height: config.height || 400,
      scale: config.scale || 0.15,
      modelUrls: config.modelUrls || this.getDefaultModelUrls(),
    };
  }

  /** 初始化 */
  async initialize(): Promise<void> {
    try {
      // 初始化 PIXI 应用（不传入 view，让 PIXI 自己创建 canvas）
      this.app = new PIXI.Application({
        transparent: true,
        autoStart: true,
        width: this.config.width,
        height: this.config.height,
        resolution: window.devicePixelRatio || 1,
      });

      // 获取 PIXI 创建的 canvas
      this.canvas = this.app.view as HTMLCanvasElement;
      
      // 设置 canvas 样式
      this.canvas.className = "live2d-canvas";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.display = "block";
      this.canvas.style.cursor = "pointer";
      
      // 将 canvas 插入到容器中
      this.config.container.appendChild(this.canvas);

      // 注册 Ticker
      Live2DModel.registerTicker(PIXI.Ticker);

      // 加载模型
      await this.loadModel();

      // 启动空闲动画
      this.startIdleAnimation();

      console.log("✅ Live2DManager 初始化成功");
    } catch (err) {
      console.error("❌ Live2DManager 初始化失败:", err);
      throw err;
    }
  }

  /** 销毁资源 */
  destroy(): void {
    // 清除空闲动画定时器
    if (this.idleAnimationTimer) {
      clearInterval(this.idleAnimationTimer);
      this.idleAnimationTimer = null;
    }

    // 清除点击延时计时器
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }

    // 从容器中移除 canvas
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    // 销毁 PIXI 应用
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      this.app = null;
    }

    this.canvas = null;
    this.model = null;
    console.log("🧹 Live2DManager 已销毁");
  }

  //--------------  模型加载  --------------

  /** 获取默认模型 URL 列表 */
  private getDefaultModelUrls(): string[] {
    return [
      // Cubism 4 模型
      "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/Senko_Normals/senko.model3.json",
      "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/Hiyori/Hiyori.model3.json",

      // Cubism 2 模型（更稳定）
      "https://unpkg.com/live2d-widget-model-shizuku@1.0.5/assets/shizuku.model.json",
      "https://unpkg.com/live2d-widget-model-tororo@1.0.5/assets/tororo.model.json",
    ];
  }

  /** 加载模型 */
  async loadModel(): Promise<void> {
    if (!this.app) {
      throw new Error("PIXI Application 未初始化");
    }

    let lastError: Error | null = null;
    const modelUrls = this.config.modelUrls;

    // 尝试加载每个模型 URL，直到成功
    for (let i = 0; i < modelUrls.length; i++) {
      const modelUrl = modelUrls[i];
      try {
        console.log(
          `🔄 尝试加载模型 (${i + 1}/${modelUrls.length}): ${modelUrl}`
        );

        const model = await Live2DModel.from(modelUrl);

        // 检查是否已销毁
        if (!this.app) {
          console.warn("管理器已销毁，取消模型加载");
          return;
        }

        this.model = model;

        // 配置模型 - 居中显示
        model.anchor.set(0.5, 0.5);
        model.scale.set(this.config.scale);
        model.x = this.app.screen.width / 2;
        model.y = this.app.screen.height / 2;

        this.app.stage.addChild(model);

        // 设置交互
        this.setupInteractions(model);

        console.log(`✅ 模型加载成功: ${modelUrl}`);

        // 输出模型信息
        this.logModelInfo();

        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Unknown error");
        console.warn(`❌ 模型加载失败: ${modelUrl}`, err);
      }
    }

    // 所有模型都加载失败
    throw new Error(
      `所有模型加载失败。最后一次错误: ${
        lastError?.message || "Unknown error"
      }\n` +
        `提示: 请将 Live2D 模型文件放到 public/models/ 目录，或检查网络连接。`
    );
  }

  //--------------  交互处理  --------------

  /** 设置模型交互 */
  private setupInteractions(model: any): void {
    model.interactive = true;
    model.buttonMode = true;

    // 点击触发随机动作（延迟触发，避免拖拽时误触）
    model.on("pointerdown", async (event: any) => {
      if (event?.target !== model) return;

      // 清除之前的延时（如果有）
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
        this.clickTimer = null;
      }

      // 延迟 150ms 触发动作，给拖拽检测留出时间
      this.clickTimer = setTimeout(async () => {
        // 延迟后再检查是否启用交互
        if (this.isInteractionEnabled) {
          await this.triggerRandomMotion();
        }
        this.clickTimer = null;
      }, 150);
    });

    // 鼠标悬停反馈
    model.on("pointerover", () => {
      document.body.style.cursor = "pointer";
    });

    model.on("pointerout", () => {
      document.body.style.cursor = "default";
    });
  }

  /** 触发随机动作 */
  private async triggerRandomMotion(duration: number = 3000): Promise<void> {
    const motions = this.getAvailableMotions();
    if (motions.length === 0) return;

    const randomMotion = motions[Math.floor(Math.random() * motions.length)];
    const defaultMotion = motions[0];

    this.playMotion(randomMotion);

    // 指定时间后恢复默认动作
    setTimeout(() => {
      if (this.currentMotion === randomMotion && !this.isSpeaking) {
        this.playMotion(defaultMotion);
      }
    }, duration);
  }

  //--------------  动画控制  --------------

  /** 获取模型支持的动作列表 */
  private getAvailableMotions(): string[] {
    if (this.motions.length > 0) return this.motions;
    if (!this.model) return [];

    try {
      const internalModel = (this.model as any).internalModel;
      if (internalModel?.motionManager?.definitions) {
        const motions = Object.keys(internalModel.motionManager.definitions);
        console.log("📋 可用动作:", motions);
        this.motions = motions;
        return motions;
      }
    } catch (err) {
      console.warn("无法获取动作列表:", err);
    }

    return [];
  }

  /** 获取模型支持的表情列表 */
  private getAvailableExpressions(): string[] {
    if (this.expressions.length > 0) return this.expressions;
    if (!this.model) return [];

    try {
      const internalModel = (this.model as any).internalModel;
      if (internalModel?.coreModel?.expressions) {
        const expressions = Object.keys(internalModel.coreModel.expressions);
        console.log("📋 可用表情:", expressions);
        this.expressions = expressions;
        return expressions;
      }
    } catch (err) {
      console.warn("无法获取表情列表:", err);
    }

    return [];
  }

  /** 启动默认动画 */
  private startIdleAnimation(): void {
    // 获取可用的动作和表情列表
    const motions = this.getAvailableMotions();
    const expressions = this.getAvailableExpressions();

    // 设置默认动作和表情（使用第一个可用项）
    const defaultMotion = motions.length > 0 ? motions[0] : "";
    const defaultExpression = expressions.length > 0 ? expressions[0] : "";

    console.log(`🎬 设置默认动作: ${defaultMotion}`);
    console.log(`😊 设置默认表情: ${defaultExpression}`);

    // 播放默认动作
    if (defaultMotion) {
      this.playMotion(defaultMotion);
    }

    // 设置默认表情
    if (defaultExpression) {
      this.applyExpression(defaultExpression);
    }

    // 清除之前的定时器
    if (this.idleAnimationTimer) {
      clearInterval(this.idleAnimationTimer);
    }

    // // 每5秒检查一次，播放随机idle动画
    // this.idleAnimationTimer = setInterval(() => {
    //   // 只有在空闲状态且不在说话时才触发随机动作
    //   if (
    //     this.currentMotion === defaultMotion &&
    //     !this.isSpeaking &&
    //     Math.random() > 0.7 &&
    //     this.model &&
    //     motions.length > 0
    //   ) {
    //     // 复用随机动作函数，2秒后恢复
    //     this.triggerRandomMotion(2000);
    //   }
    // }, 5000);
  }

  /** 输出模型信息 */
  private logModelInfo(): void {
    if (!this.model) return;

    console.log("ℹ️ === Live2D 模型信息 ===");
    this.getAvailableMotions();
    this.getAvailableExpressions();
    console.log("ℹ️ ======================");
  }

  /** 播放动作（仅播放动作，不涉及表情） */
  private playMotion(motion: string): void {
    if (!this.model) return;

    try {
      const availableMotions = this.getAvailableMotions();

      // 检查动作是否存在
      if (!availableMotions.includes(motion)) {
        console.warn(`⚠️ 动作 "${motion}" 不在可用列表中`);
        return;
      }

      // 播放动作
      const motionResult = this.model.motion(motion, 0, 2); // group, index, priority

      if (motionResult && typeof motionResult.then === "function") {
        motionResult
          .then(() => {
            console.log(`✅ 动作播放完成: ${motion}`);
          })
          .catch((err: any) => {
            console.warn(`⚠️ 动作播放失败: ${motion}`, err);
          });
      }

      // 更新当前动作
      this.currentMotion = motion;
    } catch (err) {
      console.warn(`❌ 动作 ${motion} 播放失败:`, err);
    }
  }

  /** 应用表情（仅设置表情，不涉及动作） */
  private applyExpression(expression: string): void {
    if (!this.model) return;

    try {
      const availableExpressions = this.getAvailableExpressions();

      // 检查表情是否存在
      if (!availableExpressions.includes(expression)) {
        console.warn(`⚠️ 表情 "${expression}" 不在可用列表中`);
        return;
      }

      // 设置表情
      const internalModel = (this.model as any).internalModel;
      if (internalModel?.coreModel?.setExpression) {
        internalModel.coreModel.setExpression(expression);
        console.log(`✅ 应用表情: ${expression}`);
        this.currentExpression = expression;
      }
    } catch (err) {
      console.warn(`❌ 表情 ${expression} 设置失败:`, err);
    }
  }

  //--------------  公开方法  --------------

  /** 播放动作（公开方法） */
  playModelMotion(motion: string): void {
    if (!this.model) {
      console.warn("模型未加载，无法播放动作");
      return;
    }

    this.playMotion(motion);
    console.log(`🎬 播放动作: ${motion}`);
  }

  /** 设置表情（公开方法） */
  setExpression(expression: string): void {
    if (!this.model) {
      console.warn("模型未加载，无法设置表情");
      return;
    }

    this.applyExpression(expression);
    console.log(`💭 设置表情: ${expression}`);
  }

  /** 说话（会播放说话动作和表情） */
  speak(text: string): void {
    if (!this.model) {
      console.warn("模型未加载，无法说话");
      return;
    }

    this.isSpeaking = true;

    // 尝试播放说话相关的动作
    const motions = this.getAvailableMotions();
    const speakingMotion = motions.find((m) =>
      m.toLowerCase().includes("speak")
    );
    if (speakingMotion) {
      this.playMotion(speakingMotion);
    }

    // 尝试设置说话表情
    const expressions = this.getAvailableExpressions();
    const speakingExpression = expressions.find((e) =>
      e.toLowerCase().includes("speak")
    );
    if (speakingExpression) {
      this.applyExpression(speakingExpression);
    }

    // 根据文本长度估算说话时间
    const duration = Math.max(2000, text.length * 100);

    setTimeout(() => {
      this.isSpeaking = false;

      // 恢复默认动作和表情
      if (motions.length > 0) {
        this.playMotion(motions[0]);
      }
      if (expressions.length > 0) {
        this.applyExpression(expressions[0]);
      }
    }, duration);

    console.log(`💬 说话: ${text} (${duration}ms)`);
  }

  /** 获取当前动作 */
  getCurrentMotion(): string {
    return this.currentMotion;
  }

  /** 获取当前表情 */
  getCurrentExpression(): string {
    return this.currentExpression;
  }

  /** 是否正在说话 */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /** 获取模型是否已加载 */
  isModelLoaded(): boolean {
    return this.model !== null;
  }

  /** 获取可用的动作列表（公开方法） */
  getMotions(): string[] {
    return this.getAvailableMotions();
  }

  /** 获取可用的表情列表（公开方法） */
  getExpressions(): string[] {
    return this.getAvailableExpressions();
  }

  //--------------  交互控制  --------------

  /** 启用模型交互 */
  enableInteraction(): void {
    this.isInteractionEnabled = true;
  }

  /** 禁用模型交互（如拖拽时） */
  disableInteraction(): void {
    this.isInteractionEnabled = false;
  }

  /** 获取交互启用状态 */
  isInteractive(): boolean {
    return this.isInteractionEnabled;
  }
}
