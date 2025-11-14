import { useState, useEffect, useRef, useCallback } from "react";
import "./index.scss";

export interface DialogBubbleProps {
  /** 要显示的完整文本内容 */
  content: string;
  /** 是否显示气泡 */
  isVisible: boolean;
  /** 是否显示思考中动画 */
  isThinking?: boolean;
  /** 气泡隐藏时的回调 */
  onHide?: () => void;
  /** 每页最大字符数（默认100，约4行） */
  charsPerPage?: number;
  /** 自动隐藏延迟（毫秒，默认5000） */
  autoHideDelay?: number;
}

/**
 * 游戏风格对话气泡组件 - 支持分页翻阅
 */
export function DialogBubble({
  content,
  isVisible,
  isThinking = false,
  onHide,
  charsPerPage = 100,
  autoHideDelay = 5000,
}: DialogBubbleProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevContentRef = useRef<string>("");

  //--------------  工具函数  --------------
  /** 将长文本分页（按句子智能分割） */
  const splitTextIntoPages = useCallback((text: string): string[] => {
    if (!text) return [];

    const result: string[] = [];
    let currentPage = "";
    const sentences = text.split(/([。！？\n]+)/); // 按句子分割，保留标点

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const nextLength = currentPage.length + sentence.length;

      // 如果加上当前句子会超出限制
      if (nextLength > charsPerPage && currentPage.length > 0) {
        // 当前页已满，开始新页
        result.push(currentPage.trim());
        currentPage = sentence;
      } else {
        // 还有空间，继续累加
        currentPage += sentence;
      }
    }

    // 添加最后一页
    if (currentPage.trim().length > 0) {
      result.push(currentPage.trim());
    }

    return result.length > 0 ? result : [text];
  }, [charsPerPage]);

  /** 启动自动隐藏定时器 */
  const startAutoHide = useCallback((): void => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }

    autoHideTimerRef.current = setTimeout(() => {
      if (onHide) {
        onHide();
      }
      autoHideTimerRef.current = null;
    }, autoHideDelay);
  }, [autoHideDelay, onHide]);

  //--------------  副作用  --------------
  /** 当有新内容来时，重新分页 */
  useEffect(() => {
    // 只有当内容从空变成非空，或者内容真正发生变化时，才重新分页
    const prevContent = prevContentRef.current;
    const hasNewContent = content && content !== prevContent;
    
    if (hasNewContent && !isThinking) {
      prevContentRef.current = content;
      
      // 清除可能存在的旧定时器（防止上次的定时器影响本次）
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
      
      const newPages = splitTextIntoPages(content);
      setPages(newPages);
      setCurrentPage(0);

      // 如果只有一页，直接启动自动隐藏
      if (newPages.length === 1) {
        startAutoHide();
      }
    }
    
    // 当内容被清空时，不立即重置状态，让气泡保持当前页，等隐藏动画完成
    // 下次有新内容时会自动重置
  }, [content, isThinking, splitTextIntoPages, startAutoHide]);

  /** 当翻到最后一页时，自动启动定时器 */
  useEffect(() => {
    // 只有在有内容且翻到最后一页时才启动定时器
    // 避免在组件重新显示时，旧的 state 触发误判
    if (content && pages.length > 1 && currentPage === pages.length - 1 && !isThinking) {
      // 已经是最后一页了，启动自动隐藏
      startAutoHide();
    }
  }, [currentPage, pages.length, isThinking, startAutoHide, content]);

  /** 清理定时器 */
  useEffect(() => {
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, []);

  //--------------  事件处理  --------------
  /** 翻到下一页或关闭气泡 */
  function handleNextPage(e: React.MouseEvent): void {
    // 阻止事件冒泡和默认行为，避免穿透到下层
    e.stopPropagation();
    e.preventDefault();

    if (isThinking) return;

    if (currentPage < pages.length - 1) {
      // 还有下一页，继续翻页
      setCurrentPage(currentPage + 1);

      // 清除可能存在的自动隐藏定时器
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    } else {
      // 最后一页，点击立即关闭
      // 先清除自动隐藏定时器，避免影响下次显示
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
      
      if (onHide) {
        onHide();
      }
    }
  }

  //--------------  渲染  --------------
  // 当组件隐藏时，重置状态，避免下次显示时的误判
  useEffect(() => {
    if (!isVisible) {
      // 清除定时器
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
      // 重置 state（延迟执行，确保隐藏动画完成）
      const timer = setTimeout(() => {
        setPages([]);
        setCurrentPage(0);
        prevContentRef.current = "";
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="dialog-bubble"
      onClick={handleNextPage}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      style={{ 
        cursor: !isThinking ? "pointer" : "default",
        pointerEvents: "auto" 
      }}
    >
      {isThinking ? (
        <div className="thinking-indicator">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      ) : (
        <>
          <div className="bubble-text">{pages[currentPage] || content}</div>

          {/* 页码指示器（多页时显示） */}
          {pages.length > 1 && (
            <div className="page-indicator">
              {currentPage + 1} / {pages.length}
            </div>
          )}

          {/* 下一页提示（跳动的小三角形） */}
          {currentPage < pages.length - 1 ? (
            <div className="next-page-indicator">
              <span className="triangle">▼</span>
            </div>
          ) : pages.length > 1 ? (
            // 最后一页提示点击关闭
            <div className="close-hint">点击关闭</div>
          ) : null}
        </>
      )}
    </div>
  );
}

