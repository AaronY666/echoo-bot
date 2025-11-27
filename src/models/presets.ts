/**
 * 预设的 Live2D 模型配置
 */

import { ILive2DModelDefinition } from "./Live2DModelDefinition";
import { ModelRegistry } from "./ModelRegistry";

/** 预设的 Live2D 模型配置 */
export const PRESET_MODELS: ILive2DModelDefinition[] = [
  // Cubism 4 在线模型
  {
    id: "senko",
    name: "Senko",
    description: "Senko - Cubism 4 模型",
    url: "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/Senko_Normals/senko.model3.json",
    version: 4,
    scale: 0.15, // 手动设置，优先使用
  },
  // Cubism 2 在线模型（更稳定）
  {
    id: "shizuku",
    name: "Shizuku",
    description: "Shizuku - Cubism 2 模型（稳定）",
    url: "https://unpkg.com/live2d-widget-model-shizuku@1.0.5/assets/shizuku.model.json",
    version: 2,
    // scale: 0.15, // 手动设置，优先使用
  },
  {
    id: "tororo",
    name: "Tororo",
    description: "Tororo - Cubism 2 模型（稳定）",
    url: "https://unpkg.com/live2d-widget-model-tororo@1.0.5/assets/tororo.model.json",
    version: 2,
    // scale: 0.15, // 手动设置，优先使用
  },

  // 碧蓝航线角色
  {
    id: "abeikelongbi",
    name: "阿贝克隆比",
    description: "碧蓝航线 - Cubism 4 模型",
    url: "https://raw.githubusercontent.com/Eikanya/Live2d-model/master/%E7%A2%A7%E8%93%9D%E8%88%AA%E7%BA%BF%20Azue%20Lane/Azue%20Lane(JP)/abeikelongbi_3/abeikelongbi_3.model3.json",
    version: 4,
    // 不设置 scale，使用自动计算（作为示例）
  },
  // {
  //   id: "adaerbote",
  //   name: "阿达尔贝特",
  //   description: "碧蓝航线 - Cubism 4 模型",
  //   url: "https://raw.githubusercontent.com/Eikanya/Live2d-model/master/%E7%A2%A7%E8%93%9D%E8%88%AA%E7%BA%BF%20Azue%20Lane/Azue%20Lane(JP)/adaerbote_3/adaerbote_3.model3.json",
  //   version: 4,
  // }
];

/** 初始化预设模型 - 注册到全局注册表 */
export function initPresetModels(): void {
  ModelRegistry.registerMany(PRESET_MODELS);
  console.log(`✅ 已注册 ${PRESET_MODELS.length} 个预设模型`);
}

// 自动初始化预设模型（在模块加载时）
initPresetModels();

