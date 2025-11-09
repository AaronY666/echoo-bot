import { useEffect, useRef } from "react";
import { DragManagerRenderer } from "@services/dragManager";
import "./index.scss";

/** 宠物组件 Props */
interface PetProps {
  dragManager: DragManagerRenderer;
}

/**
 * 桌面宠物组件 - 可拖拽的桌面宠物UI
 */
export function Pet({ dragManager }: PetProps) {
  const petRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 使用 DragManager 设置拖拽监听
    if (petRef.current) {
      const cleanup = dragManager.setupDragListeners(
        petRef.current,
        undefined,   // 开始拖拽
        undefined,   // 拖拽中（可选）
        undefined    // 结束拖拽
      );

      // 组件卸载时清理
      return cleanup;
    }
  }, [dragManager]);

  return (
    <div
      ref={petRef}
      className="desktop-pet"
    >
      {/* 桌宠身体 */}
      <div className="pet-body">
        {/* 脸部 */}
        <div className="pet-face">
          <div className="eyes">
            <div className="eye left-eye"></div>
            <div className="eye right-eye"></div>
          </div>
          <div className="mouth"></div>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="control-buttons">
        <button
          className="control-btn minimize-btn"
          onClick={() => dragManager.minimizeWindow()}
        >
          _
        </button>
        <button
          className="control-btn close-btn"
          onClick={() => dragManager.closeWindow()}
        >
          ×
        </button>
      </div>

      {/* 调试信息 */}
      <div className="debug-info">
        <div>🐱 AI桌宠</div>
        <div>🖱️ 拖拽移动</div>
      </div>
    </div>
  );
}

