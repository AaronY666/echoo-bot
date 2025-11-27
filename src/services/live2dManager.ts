/**
 * Live2D 管理器 - 封装 Live2D 模型的加载、交互、动画等逻辑
 */

import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";
import { Live2DModelDefinition } from "@models/Live2DModelDefinition";
import { ModelRegistry } from "@models/ModelRegistry";

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
  /** 模型定义对象（优先级最高） */
  model?: Live2DModelDefinition;
  /** 模型ID（从注册表加载） */
  modelId?: string;
}

/** 模型缓存项 */
interface CachedModel {
  model: Live2DModel;
  definition: Live2DModelDefinition;
  motions: string[];
  expressions: string[];
}

/** Live2D 管理器 */
export class Live2DManager {
  private app: PIXI.Application | null = null;
  private model: Live2DModel | null = null;
  private config: Required<Omit<Live2DManagerConfig, "model" | "modelId">>;
  private currentModelDefinition: Live2DModelDefinition | null = null;
  private idleAnimationTimer: NodeJS.Timeout | null = null;
  private currentMotion: string = "";
  private currentExpression: string = "";
  private isSpeaking: boolean = false;
  private motions: string[] = [];
  private expressions: string[] = [];
  private isInteractionEnabled: boolean = true;
  private clickTimer: NodeJS.Timeout | null = null;
  private canvas: HTMLCanvasElement | null = null;
  
  // 模型缓存
  private modelCache: Map<string, CachedModel> = new Map();
  private maxCacheSize: number = 5; // 最多缓存5个模型

  //--------------  生命周期  --------------

  constructor(config: Live2DManagerConfig) {
    this.config = {
      container: config.container,
      width: config.width || 300,
      height: config.height || 400,
      scale: config.scale || 0.15,
    };
    
    // 解析模型配置
    this.currentModelDefinition = this.resolveModelDefinition(config);
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

    // 清理缓存中的所有模型
    this.clearModelCache();

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

  //--------------  模型配置解析  --------------

  /** 解析模型定义 */
  private resolveModelDefinition(config: Live2DManagerConfig): Live2DModelDefinition | null {
    // 优先使用 model 配置
    if (config.model) {
      return config.model;
    }
    
    // 其次使用 modelId（从注册表查找）
    if (config.modelId) {
      const model = ModelRegistry.get(config.modelId);
      if (!model) {
        console.warn(`⚠️ 模型 "${config.modelId}" 未在注册表中找到`);
        return null;
      }
      return model;
    }
    
    // 如果都没有，使用注册表中的第一个模型
    const allModels = ModelRegistry.getAll();
    if (allModels.length > 0) {
      console.log("使用注册表中的第一个模型:", allModels[0].name);
      return allModels[0];
    }
    
    return null;
  }

  //--------------  模型缓存管理  --------------

  /** 从缓存获取模型 */
  private getCachedModel(modelId: string): CachedModel | undefined {
    return this.modelCache.get(modelId);
  }

  /** 缓存模型 */
  private cacheModel(modelId: string, model: Live2DModel, definition: Live2DModelDefinition, motions: string[], expressions: string[]): void {
    // 如果缓存已满，移除最早的一个
    if (this.modelCache.size >= this.maxCacheSize) {
      const firstKey = this.modelCache.keys().next().value;
      if (firstKey) {
        const cached = this.modelCache.get(firstKey);
        if (cached) {
          console.log(`🗑️ 清理缓存模型: ${firstKey}`);
          // 注意：不销毁模型，只是从缓存移除
          // 如果模型在舞台上，由切换逻辑处理
        }
        this.modelCache.delete(firstKey);
      }
    }

    this.modelCache.set(modelId, {
      model,
      definition,
      motions,
      expressions,
    });
    console.log(`💾 缓存模型: ${modelId} (缓存数: ${this.modelCache.size}/${this.maxCacheSize})`);
  }

  /** 清空模型缓存 */
  private clearModelCache(): void {
    for (const cached of this.modelCache.values()) {
      // 销毁缓存的模型（如果不在当前使用）
      if (cached.model !== this.model) {
        cached.model.destroy();
      }
    }
    this.modelCache.clear();
    console.log("🗑️ 已清空模型缓存");
  }

  //--------------  模型加载  --------------

  /** 加载模型（支持缓存） */
  async loadModel(modelDef?: Live2DModelDefinition): Promise<void> {
    if (!this.app) {
      throw new Error("PIXI Application 未初始化");
    }

    // 使用参数中的模型定义，或者使用当前配置的模型
    const modelDefinition = modelDef || this.currentModelDefinition;
    
    if (!modelDefinition) {
      throw new Error("没有可用的模型定义。请先注册模型到 ModelRegistry。");
    }

    try {
      let model: Live2DModel;
      let motions: string[];
      let expressions: string[];

      // 🔥 检查缓存
      const cached = this.getCachedModel(modelDefinition.id);
      
      if (cached) {
        console.log(`⚡ 从缓存加载模型: ${modelDefinition.name}`);
        model = cached.model;
        motions = cached.motions;
        expressions = cached.expressions;
      } else {
        console.log(`🔄 首次加载模型: ${modelDefinition.name}`);
        const modelUrl = modelDefinition.getFullUrl();
        model = await Live2DModel.from(modelUrl);

        // 检查是否已销毁
        if (!this.app) {
          console.warn("管理器已销毁，取消模型加载");
          return;
        }

        // 获取模型的动作和表情列表
        motions = [];
        expressions = [];
        
        // 配置模型 - 居中显示
        model.anchor.set(0.5, 0.5);
        
        // 自动计算缩放比例（contain 模式）
        const scale = this.calculateOptimalScale(model, modelDefinition);
        model.scale.set(scale);
        
        // 计算位置（考虑偏移）
        const baseX = this.app.screen.width / 2;
        const baseY = this.app.screen.height / 2;
        const offsetX = modelDefinition.offset?.x || 0;
        const offsetY = modelDefinition.offset?.y || 0;
        
        model.x = baseX + offsetX;
        model.y = baseY + offsetY;

        // 设置交互
        this.setupInteractions(model);

        // 🔥 缓存新加载的模型
        // 先将模型添加到场景，这样可以正确读取动作和表情
        this.app.stage.addChild(model);
        
        // 临时设置为当前模型以读取信息
        const prevModel = this.model;
        this.model = model;
        motions = this.getAvailableMotionsFromModel(model);
        expressions = this.getAvailableExpressionsFromModel(model);
        this.model = prevModel;
        
        // 从场景移除（稍后会重新添加）
        this.app.stage.removeChild(model);
        
        this.cacheModel(modelDefinition.id, model, modelDefinition, motions, expressions);
      }

      // 🔥 切换到新模型
      // 如果已有模型在显示，先移除（但不销毁，因为已缓存）
      if (this.model) {
        this.app.stage.removeChild(this.model);
      }

      this.model = model;
      this.currentModelDefinition = modelDefinition;
      this.motions = motions;
      this.expressions = expressions;

      // 将模型添加到场景
      if (!this.app.stage.children.includes(model)) {
        this.app.stage.addChild(model);
      }

      console.log(`✅ 模型切换成功: ${modelDefinition.name}`);
      console.log(`📋 可用动作 (${motions.length}):`, motions.slice(0, 5), motions.length > 5 ? '...' : '');
      console.log(`📋 可用表情 (${expressions.length}):`, expressions);

      // 重新启动空闲动画
      this.startIdleAnimation();
    } catch (err) {
      console.error(`❌ 模型加载失败: ${modelDefinition.name}`, err);
      throw err;
    }
  }

  /** 从模型获取动作列表（用于缓存） */
  private getAvailableMotionsFromModel(model: Live2DModel): string[] {
    try {
      const internalModel = (model as any).internalModel;
      if (internalModel?.motionManager?.definitions) {
        const definitions = internalModel.motionManager.definitions;
        
        const allMotions: string[] = [];
        for (const groupName in definitions) {
          if (Array.isArray(definitions[groupName])) {
            if (groupName === "") {
              const groupLength = definitions[groupName].length;
              for (let i = 0; i < groupLength; i++) {
                allMotions.push(`${groupName}@${i}`);
              }
            } else {
              allMotions.push(groupName);
            }
          }
        }
        
        if (allMotions.length === 0) {
          const motionGroups = Object.keys(definitions);
          return motionGroups.filter(g => g !== "");
        }
        
        return allMotions;
      }
    } catch (err) {
      console.warn("无法获取动作列表:", err);
    }
    return [];
  }

  /** 从模型获取表情列表（用于缓存） */
  private getAvailableExpressionsFromModel(model: Live2DModel): string[] {
    try {
      const internalModel = (model as any).internalModel;
      if (internalModel?.coreModel?.expressions) {
        return Object.keys(internalModel.coreModel.expressions);
      }
    } catch (err) {
      console.warn("无法获取表情列表:", err);
    }
    return [];
  }

  //--------------  缩放计算  --------------

  /** 计算最佳缩放比例（contain 模式）*/
  private calculateOptimalScale(model: any, modelDefinition: Live2DModelDefinition): number {
    if (!this.app) return modelDefinition.scale || this.config.scale;

    // 🔥 优先级1：如果模型定义中手动指定了缩放比例，优先使用
    if (modelDefinition.scale !== undefined) {
      console.log(`📐 使用手动设置的缩放比例: ${modelDefinition.scale}`);
      return modelDefinition.scale;
    }

    // 🔥 优先级2：自动计算最佳缩放比例
    try {
      // 获取模型原始尺寸
      const modelWidth = model.width;
      const modelHeight = model.height;
      
      // 获取容器尺寸
      const containerWidth = this.app.screen.width;
      const containerHeight = this.app.screen.height;

      if (!modelWidth || !modelHeight) {
        console.warn("⚠️ 无法获取模型尺寸，使用配置默认值");
        return this.config.scale;
      }

      // 计算宽度和高度的缩放比例（留出边距，避免紧贴边缘）
      const marginRatio = 0.95; // 留出 5% 边距
      const scaleX = (containerWidth * marginRatio) / modelWidth;
      const scaleY = (containerHeight * marginRatio) / modelHeight;

      // 使用较小的缩放比例，确保完整显示（contain）
      const optimalScale = Math.min(scaleX, scaleY);

      console.log(`📐 自动计算缩放:`);
      console.log(`   模型尺寸: ${modelWidth.toFixed(0)}x${modelHeight.toFixed(0)}`);
      console.log(`   容器尺寸: ${containerWidth}x${containerHeight}`);
      console.log(`   计算比例: ${optimalScale.toFixed(4)}`);

      return optimalScale;
    } catch (err) {
      console.warn("⚠️ 计算缩放比例失败，使用配置默认值:", err);
      return this.config.scale;
    }
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
    // 优先使用缓存的动作列表
    if (this.motions.length > 0) return this.motions;
    if (!this.model) return [];

    // 如果没有缓存，从模型读取
    this.motions = this.getAvailableMotionsFromModel(this.model);
    return this.motions;
  }

  /** 获取模型支持的表情列表 */
  private getAvailableExpressions(): string[] {
    // 优先使用缓存的表情列表
    if (this.expressions.length > 0) return this.expressions;
    if (!this.model) return [];

    // 如果没有缓存，从模型读取
    this.expressions = this.getAvailableExpressionsFromModel(this.model);
    return this.expressions;
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

      // 解析动作参数
      let group = motion;
      let index = 0;
      
      // 如果动作格式是 "group@index"，解析出来
      if (motion.includes("@")) {
        const parts = motion.split("@");
        group = parts[0];
        index = parseInt(parts[1]) || 0;
      }

      // 播放动作
      const motionResult = this.model.motion(group, index, 2); // group, index, priority

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

  //--------------  模型切换  --------------

  /** 切换模型（通过模型ID） */
  async switchModelById(modelId: string): Promise<void> {
    const modelDef = ModelRegistry.get(modelId);
    if (!modelDef) {
      throw new Error(`模型 "${modelId}" 未在注册表中找到`);
    }
    await this.switchModel(modelDef);
  }

  /** 切换模型（通过模型定义） */
  async switchModel(modelDef: Live2DModelDefinition): Promise<void> {
    console.log(`🔄 切换模型: ${modelDef.name}`);
    
    // 清除当前状态
    this.isSpeaking = false;
    this.motions = [];
    this.expressions = [];
    this.currentMotion = "";
    this.currentExpression = "";
    
    // 清除空闲动画定时器
    if (this.idleAnimationTimer) {
      clearInterval(this.idleAnimationTimer);
      this.idleAnimationTimer = null;
    }
    
    // 加载新模型
    await this.loadModel(modelDef);
  }

  /** 获取当前模型定义 */
  getCurrentModelDefinition(): Live2DModelDefinition | null {
    return this.currentModelDefinition;
  }

  /** 获取当前模型ID */
  getCurrentModelId(): string | null {
    return this.currentModelDefinition?.id || null;
  }
}
