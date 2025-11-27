/**
 * 模型配置加载器 - 从配置文件动态加载模型定义
 */

import { ILive2DModelDefinition } from "./Live2DModelDefinition";
import { ModelRegistry } from "./ModelRegistry";

/** 配置文件格式 */
interface ModelConfigFile {
  models: ILive2DModelDefinition[];
}

/** 从配置文件加载模型定义 */
export async function loadModelsFromConfig(configUrl: string): Promise<void> {
  try {
    const response = await fetch(configUrl);
    
    if (!response.ok) {
      throw new Error(`加载配置文件失败: ${response.status} ${response.statusText}`);
    }
    
    const config: ModelConfigFile = await response.json();
    
    if (!config.models || !Array.isArray(config.models)) {
      throw new Error("配置文件格式错误: models 字段必须是数组");
    }
    
    ModelRegistry.registerMany(config.models);
    console.log(`✅ 从配置文件加载了 ${config.models.length} 个模型`);
  } catch (err) {
    console.error("❌ 加载模型配置文件失败:", err);
    throw err;
  }
}

/** 从多个配置文件加载模型定义 */
export async function loadModelsFromConfigs(configUrls: string[]): Promise<void> {
  const promises = [];
  for (let i = 0; i < configUrls.length; i++) {
    promises.push(loadModelsFromConfig(configUrls[i]));
  }
  await Promise.all(promises);
}

