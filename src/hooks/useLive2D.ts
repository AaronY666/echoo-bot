/**
 * useLive2D - Live2D 模型管理 Hook
 * 封装 Live2DManager 的生命周期管理
 */

import { useEffect, useRef, useState } from "react";
import { Live2DManager, Live2DManagerConfig } from "@services/live2dManager";

interface UseLive2DResult {
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** Live2D 管理器实例 */
  manager: Live2DManager | null;
  /** 当前动作 */
  currentMotion: string;
  /** 当前表情 */
  currentExpression: string;
  /** 是否正在说话 */
  isSpeaking: boolean;
  /** 重新初始化 */
  reinitialize: () => Promise<void>;
}

/**
 * Live2D Hook - 管理 Live2D 模型的加载和生命周期
 */
export function useLive2D(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config?: Omit<Live2DManagerConfig, "canvas">
): UseLive2DResult {
  const managerRef = useRef<Live2DManager | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMotion, setCurrentMotion] = useState<string>("");
  const [currentExpression, setCurrentExpression] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  /** 初始化 Live2D */
  const initialize = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!canvasRef.current) {
        throw new Error("Canvas element not found");
      }

      // 创建 Live2D 管理器
      const manager = new Live2DManager({
        canvas: canvasRef.current,
        ...config,
      });

      // 初始化
      await manager.initialize();

      managerRef.current = manager;
      setIsLoading(false);
      console.log("✅ useLive2D 初始化成功");
    } catch (err) {
      console.error("❌ useLive2D 初始化失败:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setIsLoading(false);
    }
  };

  /** 重新初始化 */
  const reinitialize = async (): Promise<void> => {
    // 清理旧实例
    if (managerRef.current) {
      managerRef.current.destroy();
      managerRef.current = null;
    }

    // 重新初始化
    await initialize();
  };

  useEffect(() => {
    initialize();

    // 清理函数
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
    };
  }, []); // 只在挂载时执行一次

  // 定期同步状态（从 manager 读取当前状态）
  useEffect(() => {
    if (!managerRef.current) return;

    const syncState = () => {
      if (managerRef.current) {
        setCurrentMotion(managerRef.current.getCurrentMotion());
        setCurrentExpression(managerRef.current.getCurrentExpression());
        setIsSpeaking(managerRef.current.getIsSpeaking());
      }
    };

    // 初始同步
    syncState();

    // 每 100ms 同步一次状态
    const interval = setInterval(syncState, 100);

    return () => {
      clearInterval(interval);
    };
  }, [managerRef.current, isLoading]); // manager 变化或加载完成时重新设置

  return {
    isLoading,
    error,
    manager: managerRef.current,
    currentMotion,
    currentExpression,
    isSpeaking,
    reinitialize,
  };
}

