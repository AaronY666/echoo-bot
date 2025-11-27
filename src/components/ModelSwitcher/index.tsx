import { useState } from "react";
import { ModelRegistry } from "@models/ModelRegistry";
import { Live2DModelDefinition } from "@models/Live2DModelDefinition";
import "./index.scss";

export interface ModelSwitcherProps {
  /** 当前模型ID */
  currentModelId: string | null;
  /** 切换模型回调 */
  onSwitch: (modelId: string) => void;
}

/**
 * 模型切换器组件 - 显示并切换 Live2D 模型
 */
export function ModelSwitcher({ currentModelId, onSwitch }: ModelSwitcherProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [models, setModels] = useState<Live2DModelDefinition[]>(() => ModelRegistry.getAll());

  //--------------  事件处理  --------------
  /** 切换下拉菜单 */
  function toggleMenu(): void {
    setIsOpen(!isOpen);
    // 每次打开时刷新模型列表（支持动态加载）
    if (!isOpen) {
      setModels(ModelRegistry.getAll());
    }
  }

  /** 选择模型 */
  function handleSelectModel(modelId: string): void {
    if (modelId !== currentModelId) {
      onSwitch(modelId);
    }
    setIsOpen(false);
  }

  //--------------  渲染  --------------
  const currentModel = currentModelId ? ModelRegistry.get(currentModelId) : null;

  return (
    <div className="model-switcher">
      {/* 当前模型显示按钮 */}
      <button 
        className="switcher-button" 
        onClick={toggleMenu}
        title="切换模型"
      >
        <span className="model-icon">🎭</span>
        <span className="model-name">{currentModel?.name || "选择模型"}</span>
        <span className={`arrow ${isOpen ? "open" : ""}`}>▼</span>
      </button>

      {/* 模型列表下拉菜单 */}
      {isOpen && (
        <div className="model-list">
          {models.length === 0 ? (
            <div className="empty-state">暂无可用模型</div>
          ) : (
            models.map((model) => (
              <div
                key={model.id}
                className={`model-item ${model.id === currentModelId ? "active" : ""}`}
                onClick={() => handleSelectModel(model.id)}
              >
                <span className="model-name">{model.name}</span>
                {model.description && (
                  <span className="model-desc">{model.description}</span>
                )}
                {model.id === currentModelId && (
                  <span className="check-icon">✓</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

