import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { DragManagerRenderer } from "./services/dragManager";

// 扩展 Window 接口
declare global {
  interface Window {
    require?: (module: string) => any;
  }
}

// 创建拖拽管理器实例
const dragManager = new DragManagerRenderer();

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const petRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("✅ React组件已加载");

    // 使用 DragManager 设置拖拽监听
    if (petRef.current) {
      const cleanup = dragManager.setupDragListeners(
        petRef.current,
        () => setIsDragging(true),   // 开始拖拽
        undefined,                     // 拖拽中（可选）
        () => setIsDragging(false)    // 结束拖拽
      );

      // 组件卸载时清理
      return cleanup;
    }
  }, []);

  return (
    <div className="app">
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
    </div>
  );
}

export default App;


