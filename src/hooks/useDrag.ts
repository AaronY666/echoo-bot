/**
 * useDrag - 拖拽自定义 Hook
 * 提供元素拖拽功能，支持边界限制和鼠标穿透控制
 */

import { useEffect, useRef, useState } from "react";
import { ipcEvent } from "@services/ipcEvent";

interface UseDragOptions {
  /** 容器宽度 */
  width: number;
  /** 容器高度 */
  height: number;
  /** 排除的选择器（点击这些元素不触发拖拽） */
  excludeSelector?: string;
  /** 是否启用鼠标穿透控制（Electron 环境） */
  enableMousePassthrough?: boolean;
  /** 额外的高度（如输入框） */
  extraHeight?: number;
}

interface DragState {
  isDragging: boolean;
  offsetX: number;
  offsetY: number;
}

/**
 * 拖拽 Hook
 * @returns isDragging - 是否正在拖拽
 */
export function useDrag(
  containerRef: React.RefObject<HTMLElement>,
  options: UseDragOptions
): { isDragging: boolean } {
  const {
    width,
    height,
    excludeSelector,
    enableMousePassthrough = true,
    extraHeight = 0,
  } = options;

  const dragStateRef = useRef<DragState>({
    isDragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  // 使用 useState 跟踪拖拽状态，以便组件能响应
  const [isDragging, setIsDragging] = useState<boolean>(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    //--------------  鼠标穿透控制  --------------

    const setMousePassthrough = (passthrough: boolean) => {
      if (!enableMousePassthrough) return;
      if (!ipcEvent.isElectronEnvironment()) return;

      try {
        ipcEvent.emit("set-ignore-mouse-events", passthrough, {
          forward: passthrough,
        });
      } catch (err) {
        console.warn("设置鼠标穿透失败:", err);
      }
    };

    const handleMouseEnter = () => {
      setMousePassthrough(false); // 进入容器，取消穿透
    };

    const handleMouseLeave = () => {
      if (!dragStateRef.current.isDragging) {
        setMousePassthrough(true); // 离开容器且未拖拽，恢复穿透
      }
    };

    //--------------  拖拽逻辑  --------------

    const handleMouseDown = (e: MouseEvent) => {
      // 排除特定元素
      if (excludeSelector) {
        const target = e.target as HTMLElement;
        if (target.closest(excludeSelector)) {
          return;
        }
      }

      const rect = container.getBoundingClientRect();
      dragStateRef.current.isDragging = true;
      dragStateRef.current.offsetX = e.clientX - rect.left;
      dragStateRef.current.offsetY = e.clientY - rect.top;

      // 更新状态以通知外部组件
      setIsDragging(true);

      container.style.cursor = "grabbing";
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;

      let newX = e.clientX - dragStateRef.current.offsetX;
      let newY = e.clientY - dragStateRef.current.offsetY;

      // 边界检查 - 包含输入框等额外高度
      // 使用 window.innerWidth/innerHeight，因为窗口已覆盖所有屏幕
      const totalHeight = height + extraHeight;
      const maxX = window.innerWidth - width;
      const maxY = window.innerHeight - totalHeight;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      // 直接操作 DOM，避免 re-render
      container.style.left = `${newX}px`;
      container.style.top = `${newY}px`;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;

      dragStateRef.current.isDragging = false;

      // 更新状态以通知外部组件
      setIsDragging(false);

      container.style.cursor = "move";

      // 检查鼠标是否还在容器内
      if (enableMousePassthrough) {
        const rect = container.getBoundingClientRect();
        const isMouseInside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;

        if (!isMouseInside) {
          setMousePassthrough(true); // 松开后鼠标不在容器内，恢复穿透
        }
      }
    };

    //--------------  绑定事件  --------------

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    //--------------  清理  --------------

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef, width, height, excludeSelector, enableMousePassthrough, extraHeight]);

  return {
    isDragging,
  };
}
