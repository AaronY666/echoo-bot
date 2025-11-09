import { useEffect } from "react";
import "./App.css";
import { DragManagerRenderer } from "@services/dragManager";
import { Pet } from "./components/Pet";

// 扩展 Window 接口
declare global {
  interface Window {
    require?: (module: string) => any;
  }
}

// 创建拖拽管理器实例
const dragManager = new DragManagerRenderer();

function App() {
  useEffect(() => {
    console.log("✅ React组件已加载");
  }, []);

  return (
    <div className="app">
      <Pet dragManager={dragManager} />
    </div>
  );
}

export default App;


