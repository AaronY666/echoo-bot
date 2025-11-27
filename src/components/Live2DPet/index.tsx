import React, {
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { useDrag } from "@hooks/useDrag";
import { useLive2D } from "@hooks/useLive2D";
import { ipcEvent } from "@services/ipcEvent";
import { DialogBubble } from "@components/DialogBubble";
import { ChatInput } from "@components/ChatInput";
import { HistoryPanel } from "@components/HistoryPanel";
import { ModelSwitcher } from "@components/ModelSwitcher";
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
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // 控制按钮显示状态
  const [showControls, setShowControls] = React.useState<boolean>(false);
  
  //--------------  聊天输入相关状态  --------------
  const [showInput, setShowInput] = React.useState<boolean>(false);
  const [showHistory, setShowHistory] = React.useState<boolean>(false);
  const [userMessage, setUserMessage] = React.useState<string>("");
  const [aiResponse, setAiResponse] = React.useState<string>("");
  const [isThinking, setIsThinking] = React.useState<boolean>(false);
  const [currentModelId, setCurrentModelId] = React.useState<string | null>(null);
  const [isSwitchingModel, setIsSwitchingModel] = React.useState<boolean>(false);

  // 使用 Live2D Hook（状态由 Hook 管理）
  const {
    isLoading,
    error,
    manager,
    reinitialize,
  } = useLive2D(canvasContainerRef, {
    width: 300,
    height: 400,
  });

  // 使用拖拽 Hook（排除控制按钮、输入框、历史面板、对话气泡和模型切换器）
  const { isDragging } = useDrag(containerRef, {
    width: 300,
    height: 400,
    excludeSelector: ".control-btn, .chat-input-container, .chat-input, .send-btn, .close-input-btn, .history-btn, .history-panel, .dialog-bubble, .model-switcher",
    enableMousePassthrough: true,
    extraHeight: showInput ? 100 : 0, // 输入框显示时增加额外高度
  });

  // 设置初始位置（主屏幕右下角）
  useEffect(() => {
    if (!containerRef.current) return;
    
    // 使用 screen.width/height 获取主屏幕尺寸
    const mainScreenWidth = window.screen.width;
    const mainScreenHeight = window.screen.height;
    
    // 计算主屏幕右下角位置
    const initialLeft = mainScreenWidth - 300 - 100; // 宽度 - 桌宠宽度 - 右边距
    const initialTop = mainScreenHeight - 400 - 140; // 高度 - 桌宠高度 - 下边距
    
    containerRef.current.style.left = `${initialLeft}px`;
    containerRef.current.style.top = `${initialTop}px`;
  }, []); // 只在组件挂载时执行一次

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

  //--------------  窗口控制函数  --------------
  const handleMinimize = (): void => {
    ipcEvent.emit("minimize-window");
  };

  const handleClose = (): void => {
    ipcEvent.emit("close-window");
  };

  //--------------  聊天功能函数  --------------
  /** 切换输入框显示 */
  const toggleInput = (): void => {
    setShowInput(!showInput);
    setShowHistory(false); // 打开输入框时关闭历史面板
  };

  /** 切换历史记录显示 */
  const handleToggleHistory = (): void => {
    setShowHistory(!showHistory);
  };

  /** 发送消息给主进程 */
  const handleSendMessage = (): void => {
    const trimmedMessage = userMessage.trim();
    if (!trimmedMessage) return;

    // 发送给主进程
    ipcEvent.emit("send-chat-message", trimmedMessage);
    
    // 清空输入框，显示思考状态
    setUserMessage("");
    setIsThinking(true);
    setAiResponse(""); // 清空上次响应
  };

  //--------------  气泡隐藏处理  --------------
  /** 气泡隐藏时的回调 */
  const handleBubbleHide = (): void => {
    setAiResponse("");
    setIsThinking(false);
  };

  //--------------  模型切换处理  --------------
  /** 切换模型 */
  const handleSwitchModel = async (modelId: string): Promise<void> => {
    if (!manager) return;
    
    setIsSwitchingModel(true);
    
    try {
      await manager.switchModelById(modelId);
      setCurrentModelId(modelId);
      console.log(`✅ 已切换到模型: ${modelId}`);
    } catch (err) {
      console.error("❌ 模型切换失败:", err);
    } finally {
      setIsSwitchingModel(false);
    }
  };

  //--------------  同步当前模型ID  --------------
  useEffect(() => {
    if (manager && !currentModelId) {
      const modelId = manager.getCurrentModelId();
      if (modelId) {
        setCurrentModelId(modelId);
      }
    }
  }, [manager, currentModelId]);

  //--------------  监听 Python 响应  --------------
  useEffect(() => {
    const unsubscribe = ipcEvent.on("chat-response", (data: any) => {
      const response = data.message || data;
      
      // 设置响应内容
      setAiResponse(response);
      setIsThinking(false);
      
      // 触发 live2d 说话
      if (manager) {
        manager.speak(response);
      }
    });

    return unsubscribe;
  }, [manager]);

  return (
    <div
      ref={containerRef}
      className="live2d-pet"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Live2D画布容器 - PIXI 会在这里插入 canvas */}
      <div ref={canvasContainerRef} className="live2d-canvas-container" />

      {/* 控制按钮 - 仅在鼠标悬停时显示 */}
      {showControls && (
        <div className="control-buttons">
        <button
          className="control-btn chat-btn"
          onClick={toggleInput}
          title="聊天"
        >
          💬
        </button>
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

      {/* 模型切换器 - 仅在鼠标悬停时显示 */}
      {!isLoading && !error && showControls && (
        <ModelSwitcher
          currentModelId={currentModelId}
          onSwitch={handleSwitchModel}
        />
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-text">加载桌宠中...</div>
        </div>
      )}

      {/* 模型切换加载状态 */}
      {isSwitchingModel && !isLoading && (
        <div className="loading-overlay switching">
          <div className="loading-spinner"></div>
          <div className="loading-text">切换模型中...</div>
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

      {/* AI 响应气泡 - 游戏风格分页 */}
      <DialogBubble
        content={aiResponse}
        isVisible={!!(aiResponse || isThinking) && !showHistory}
        isThinking={isThinking}
        onHide={handleBubbleHide}
        charsPerPage={100}
      />

      {/* 历史记录面板 - 在左侧 */}
      {showInput && showHistory && (
        <HistoryPanel isVisible={showHistory} />
      )}

      {/* 聊天输入框 - 始终在底部 */}
      {showInput && (
        <ChatInput
          value={userMessage}
          onChange={setUserMessage}
          onSend={handleSendMessage}
          onClose={toggleInput}
          onToggleHistory={handleToggleHistory}
          showHistory={showHistory}
          disabled={isThinking}
        />
      )}
    </div>
  );
});

Live2DPet.displayName = "Live2DPet";

export { Live2DPet };
