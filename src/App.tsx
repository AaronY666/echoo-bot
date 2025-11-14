import { useEffect, useRef } from "react";
import "./App.scss";
import { Live2DPet, Live2DPetHandle } from "@components/Live2DPet";
import { ipcEvent } from "@services/ipcEvent";

// 扩展 Window 接口
declare global {
  interface Window {
    require?: (module: string) => any;
    electronAPI?: {
      onPetMessage: (listener: (event: any, message: any) => void) => void;
      minimizeWindow: () => void;
      closeWindow: () => void;
      sendUserInput: (input: string) => void;
      startListening: () => void;
      stopListening: () => void;
    };
  }
}

function App() {
  const live2dPetRef = useRef<Live2DPetHandle>(null);

  useEffect(() => {
    console.log("✅ React组件已加载");

    // 使用 ipcEvent 监听来自主进程的消息
    const unsubscribePetMessage = ipcEvent.on("pet-message", (message: any) => {
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
    });

    // 检查运行环境
    const env = ipcEvent.getEnvironment();
    console.log(`ℹ️ 当前运行环境: ${env}`);

    return () => {
      // 清理：取消事件监听
      unsubscribePetMessage();
    };
  }, []);

  return (
    <div className="app">
      {/* Live2D桌面宠物 - 集成拖拽功能 */}
      <Live2DPet ref={live2dPetRef} />
    </div>
  );
}

export default App;
