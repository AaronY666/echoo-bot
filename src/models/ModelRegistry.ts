/**
 * 模型注册表 - 管理所有可用的 Live2D 模型
 */

import { Live2DModelDefinition, ILive2DModelDefinition } from "./Live2DModelDefinition";

/** 模型注册表 */
export class ModelRegistry {
  private static models: Map<string, Live2DModelDefinition> = new Map();

  /** 注册模型 */
  static register(config: ILive2DModelDefinition): void {
    const model = new Live2DModelDefinition(config);
    this.models.set(model.id, model);
  }

  /** 批量注册模型 */
  static registerMany(configs: ILive2DModelDefinition[]): void {
    for (let i = 0; i < configs.length; i++) {
      this.register(configs[i]);
    }
  }

  /** 获取模型 */
  static get(id: string): Live2DModelDefinition | undefined {
    return this.models.get(id);
  }

  /** 获取所有模型 */
  static getAll(): Live2DModelDefinition[] {
    return Array.from(this.models.values());
  }

  /** 获取所有模型ID */
  static getAllIds(): string[] {
    return Array.from(this.models.keys());
  }

  /** 检查模型是否存在 */
  static has(id: string): boolean {
    return this.models.has(id);
  }

  /** 清空注册表 */
  static clear(): void {
    this.models.clear();
  }

  /** 获取在线模型列表 */
  static getOnlineModels(): Live2DModelDefinition[] {
    const allModels = this.getAll();
    const result: Live2DModelDefinition[] = [];
    for (let i = 0; i < allModels.length; i++) {
      if (allModels[i].isOnline()) {
        result.push(allModels[i]);
      }
    }
    return result;
  }

  /** 获取本地模型列表 */
  static getLocalModels(): Live2DModelDefinition[] {
    const allModels = this.getAll();
    const result: Live2DModelDefinition[] = [];
    for (let i = 0; i < allModels.length; i++) {
      if (allModels[i].isLocal()) {
        result.push(allModels[i]);
      }
    }
    return result;
  }

  /** 获取模型总数 */
  static count(): number {
    return this.models.size;
  }
}

