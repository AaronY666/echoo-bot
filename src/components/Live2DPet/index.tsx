import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Application } from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";
import { DragManagerRenderer } from "@services/dragManager";
import "./index.scss";

/** Live2D宠物组件 Props */
interface Live2DPetProps {
  dragManager: DragManagerRenderer;
}

/** Live2D宠物组件暴露的方法 */
export interface Live2DPetHandle {
  setExpression: (expression: string) => void;
  speak: (text: string) => void;
}

/**
 * Live2D桌面宠物组件 - 支持高级动画的桌宠
 */
const Live2DPet = forwardRef<Live2DPetHandle, Live2DPetProps>(({ dragManager }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  
  const [currentExpression, setCurrentExpression] = React.useState<string>("idle");
  const [isSpeaking, setIsSpeaking] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    setExpression: (expression: string) => {
      setCurrentExpression(expression);
      updateExpression(expression);
    },
    speak: (text: string) => {
      handleSpeak(text);
    }
  }));

  useEffect(() => {
    initializePixiApp();
    return () => {
      cleanupPixiApp();
    };
  }, []);

  useEffect(() => {
    if (modelRef.current) {
      updateExpression(currentExpression);
    }
  }, [currentExpression]);

  /** 初始化Pixi应用 */
  const initializePixiApp = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!canvasRef.current) {
        throw new Error("Canvas element not found");
      }

      // 初始化Pixi应用
      appRef.current = new Application({
        view: canvasRef.current,
        transparent: true,
        autoStart: true,
        backgroundAlpha: 0,
        width: 300,
        height: 400,
        resolution: window.devicePixelRatio || 1
      });

      // 设置拖拽
      setupDragHandling();

      // 加载Live2D模型
      await loadLive2DModel();

      // 启动空闲动画
      startIdleAnimation();

      setIsLoading(false);

    } catch (err) {
      console.error("Failed to initialize Live2D:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setIsLoading(false);
    }
  };

  /** 设置拖拽处理 */
  const setupDragHandling = (): void => {
    if (!containerRef.current) return;

    const cleanup = dragManager.setupDragListeners(
      containerRef.current,
      undefined,
      undefined,
      undefined
    );
  };

  /** 加载Live2D模型 */
  const loadLive2DModel = async (): Promise<void> => {
    if (!appRef.current) {
      throw new Error("Pixi application not initialized");
    }

    try {
      // 使用免费Live2D模型 - 替换成你自己的模型路径
      const modelUrl = "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/assets/shizuku/shizuku.model.json";
      
      const model = await Live2DModel.from(modelUrl);
      modelRef.current = model;

      // 配置模型
      model.scale.set(0.15);
      model.x = appRef.current.screen.width / 2;
      model.y = appRef.current.screen.height / 2 + 50;

      appRef.current.stage.addChild(model);

      // 设置模型交互
      setupModelInteractions(model);

    } catch (err) {
      throw new Error(`Failed to load Live2D model: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  /** 设置模型交互 */
  const setupModelInteractions = (model: Live2DModel): void => {
    model.interactive = true;
    model.buttonMode = true;

    // 点击身体触发随机动作
    model.on("pointerdown", (event) => {
      if (event.target === model) {
        triggerRandomMotion();
      }
    });

    // 模型点击区域反馈
    model.on("pointerover", () => {
      document.body.style.cursor = "pointer";
    });

    model.on("pointerout", () => {
      document.body.style.cursor = "default";
    });
  };

  /** 启动空闲动画 */
  const startIdleAnimation = (): void => {
    const idleInterval = setInterval(() => {
      if (currentExpression === "idle" && Math.random() > 0.7 && modelRef.current) {
        const idleMotions = ["blink", "breath", "head_tilt"];
        const randomMotion = idleMotions[Math.floor(Math.random() * idleMotions.length)];
        
        updateExpression(randomMotion);
        
        setTimeout(() => {
          if (currentExpression === randomMotion) {
            setCurrentExpression("idle");
          }
        }, 2000);
      }
    }, 5000);

    return () => clearInterval(idleInterval);
  };

  /** 触发随机动作 */
  const triggerRandomMotion = (): void => {
    const motions = ["happy", "surprised", "angry", "shake"];
    const randomMotion = motions[Math.floor(Math.random() * motions.length)];
    setCurrentExpression(randomMotion);
    
    setTimeout(() => {
      if (currentExpression === randomMotion) {
        setCurrentExpression("idle");
      }
    }, 3000);
  };

  /** 更新表情/动作 */
  const updateExpression = (expression: string): void => {
    if (!modelRef.current) return;

    try {
      const motion = modelRef.current.motion(expression);
      if (motion) {
        motion.play();
      }
    } catch (err) {
      console.warn(`Motion ${expression} not found or failed to play`);
    }
  };

  /** 处理说话 */
  const handleSpeak = (text: string): void => {
    setIsSpeaking(true);
    setCurrentExpression("speaking");
    
    // 根据文本长度估算说话时间
    const duration = Math.max(2000, text.length * 100);
    
    setTimeout(() => {
      setIsSpeaking(false);
      setCurrentExpression("idle");
    }, duration);
  };

  /** 清理Pixi应用 */
  const cleanupPixiApp = (): void => {
    if (appRef.current) {
      appRef.current.destroy(true);
      appRef.current = null;
    }
    modelRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="live2d-pet"
    >
      {/* Live2D画布 */}
      <canvas
        ref={canvasRef}
        className="live2d-canvas"
      />

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

      {/* 状态指示器 */}
      <div className="status-indicator">
        <div className={`status-dot ${isSpeaking ? "speaking" : currentExpression}`} 
             title={isSpeaking ? "说话中" : `状态: ${currentExpression}`} />
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
          <button 
            className="retry-btn"
            onClick={() => initializePixiApp()}
          >
            重试
          </button>
        </div>
      )}

      {/* 调试信息 */}
      <div className="debug-info">
        <div>🐱 Live2D桌宠</div>
        <div>🖱️ 拖拽移动</div>
        <div>💬 点击交互</div>
        {currentExpression && <div>状态: {currentExpression}</div>}
      </div>
    </div>
  );
});

Live2DPet.displayName = "Live2DPet";

export { Live2DPet };