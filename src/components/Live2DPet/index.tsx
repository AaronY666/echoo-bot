import React, {
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { useDrag } from "@hooks/useDrag";
import { useLive2D } from "@hooks/useLive2D";
import { ipcEvent } from "@services/ipcEvent";
import "./index.scss";

/** Live2D宠物组件暴露的方法 */
export interface Live2DPetHandle {
  setExpression: (expression: string) => void;
  speak: (text: string) => void;
}

/**
 * Live2D桌面宠物组件 - 支持高级动画的桌宠
 * 使用 useDrag 和 useLive2D Hooks
 */
const Live2DPet = forwardRef<Live2DPetHandle, {}>((_props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 控制按钮显示状态
  const [showControls, setShowControls] = React.useState<boolean>(false);

  // 使用 Live2D Hook（状态由 Hook 管理）
  const {
    isLoading,
    error,
    manager,
    currentMotion,
    currentExpression,
    isSpeaking,
    reinitialize,
  } = useLive2D(canvasRef, {
    width: 300,
    height: 400,
    scale: 0.15,
  });

  // 使用拖拽 Hook（排除控制按钮）
  const { isDragging } = useDrag(containerRef, {
    width: 300,
    height: 400,
    excludeSelector: ".control-btn",
    enableMousePassthrough: true,
  });

  // 监听拖拽状态，控制 Live2D 交互
  useEffect(() => {
    if (!manager) return;

    if (isDragging) {
      // 拖拽时禁用交互，避免触发点击事件
      manager.disableInteraction();
    } else {
      // 拖拽结束后恢复交互
      manager.enableInteraction();
    }
  }, [isDragging, manager]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    setExpression: (expression: string) => {
      if (manager) {
        manager.setExpression(expression);
        // 状态由 useLive2D Hook 自动同步
      }
    },
    speak: (text: string) => {
      if (manager) {
        manager.speak(text);
        // 状态由 useLive2D Hook 自动同步
      }
    },
  }));

  /** 窗口控制函数 */
  const handleMinimize = (): void => {
    ipcEvent.emit("minimize-window");
  };

  const handleClose = (): void => {
    ipcEvent.emit("close-window");
  };

  return (
    <div
      ref={containerRef}
      className="live2d-pet"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Live2D画布 */}
      <canvas ref={canvasRef} className="live2d-canvas" />

      {/* 控制按钮 - 仅在鼠标悬停时显示 */}
      {showControls && (
        <div className="control-buttons">
        <button
          className="control-btn minimize-btn"
          onClick={handleMinimize}
          title="最小化"
        >
          _
        </button>
        <button
          className="control-btn close-btn"
          onClick={handleClose}
          title="关闭"
        >
          ×
        </button>
        </div>
      )}

      {/* 状态指示器 */}
      <div className="status-indicator">
        <div
          className={`status-dot ${
            isSpeaking ? "speaking" : currentExpression
          }`}
          title={isSpeaking ? "说话中" : `状态: ${currentExpression}`}
        />
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-text">加载桌宠中...</div>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="error-overlay">
          <div className="error-icon">⚠️</div>
          <div className="error-text">加载失败</div>
          <button className="retry-btn" onClick={reinitialize}>
            重试
          </button>
        </div>
      )}

      {/* 调试信息 */}
      <div className="debug-info">
        {currentMotion && <div>动作: {currentMotion}</div>}
        {currentExpression && <div>表情: {currentExpression}</div>}
        {isSpeaking && <div>🗣️ 说话中</div>}
      </div>
    </div>
  );
});

Live2DPet.displayName = "Live2DPet";

export { Live2DPet };
