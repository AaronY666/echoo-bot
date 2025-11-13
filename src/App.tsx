import { useEffect, useRef } from "react";
import "./App.scss";
import { DragManagerRenderer } from "@services/dragManager";
import { Live2DPet, Live2DPetHandle } from "@components/Live2DPet";
import { TestControls } from "@components/TestControls";

// 扩展 Window 接口
declare global {
  interface Window {
    require?: (module: string) => any;
    electronAPI?: {
      onPetMessage: (listener: (event: any, message: any) => void) => void;
      minimizeWindow: () => void;
      closeWindow: () => void;
      dragWindow: (x: number, y: number) => void;
      sendUserInput: (input: string) => void;
      startListening: () => void;
      stopListening: () => void;
    };
  }
}

// 创建拖拽管理器实例
const dragManager = new DragManagerRenderer();

function App() {
  const live2dPetRef = useRef<Live2DPetHandle>(null);

  useEffect(() => {
    console.log("✅ React组件已加载");

    // 设置消息监听器
    const handlePetMessage = (event: any, message: any) => {
      console.log("📨 收到消息:", message);

      if (live2dPetRef.current) {
        switch (message.type) {
          case "expression":
            live2dPetRef.current.setExpression(message.expression);
            break;
          case "speak":
            live2dPetRef.current.speak(message.text);
            break;
          default:
            console.warn("未知消息类型:", message.type);
        }
      }
    };

    // 监听Electron消息（如果可用）
    if (window.electronAPI) {
      window.electronAPI.onPetMessage(handlePetMessage);
      console.log("✅ Electron API 已连接");
    } else {
      console.log("⚠️ Electron API 不可用（可能是浏览器环境）");
    }

    // 开发环境下添加测试消息
    if (process.env.NODE_ENV === "development") {
      // 延迟发送欢迎消息，确保组件已加载
      setTimeout(() => {
        if (live2dPetRef.current) {
          live2dPetRef.current.setExpression("happy");
          setTimeout(() => {
            live2dPetRef.current?.speak("你好！我是你的智能桌宠");
          }, 1000);
        }
      }, 2000);
    }

    return () => {
      // 清理工作（如果需要）
    };
  }, []);

  return (
    <div className="app">
      {/* 替换原来的Pet组件为Live2DPet */}
      <Live2DPet
        ref={live2dPetRef}
        dragManager={dragManager}
      />

      {/* 开发环境下的测试控件 */}
      {process.env.NODE_ENV === "development" && (
        <TestControls />
      )}
    </div>
  );
}

export default App;