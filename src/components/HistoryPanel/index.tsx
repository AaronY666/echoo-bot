import { useState, useEffect, useRef } from "react";
import Markdown from "markdown-to-jsx";
import { ipcEvent } from "@services/ipcEvent";
import "./index.scss";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface HistoryPanelProps {
  /** 是否显示面板 */
  isVisible: boolean;
}

/**
 * 历史记录面板组件 - 显示对话历史
 */
export function HistoryPanel({ isVisible }: HistoryPanelProps) {
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const historyListRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottom = useRef<boolean>(false);

  //--------------  加载历史记录  --------------
  useEffect(() => {
    if (isVisible) {
      loadHistory();
    }
  }, [isVisible]);

  //--------------  监听新消息，实时更新  --------------
  useEffect(() => {
    if (!isVisible) return;

    // 监听AI响应，当有新消息时刷新历史记录
    const unsubscribe = ipcEvent.on("chat-response", () => {
      // 标记需要滚动到底部
      shouldScrollToBottom.current = true;
      // 延迟刷新，确保消息已保存
      setTimeout(() => {
        loadHistory();
      }, 500);
    });

    return unsubscribe;
  }, [isVisible]);

  /** 加载历史记录 */
  async function loadHistory(): Promise<void> {
    setIsLoading(true);
    setError("");

    try {
      // 通过 IPC 获取历史记录
      const history = await ipcEvent.invoke("get-chat-history");
      
      if (Array.isArray(history)) {
        setMessages(history);
        
        // 根据情况决定是否滚动到底部
        setTimeout(() => {
          if (historyListRef.current) {
            // 如果是刚打开或收到新消息，滚动到底部
            if (shouldScrollToBottom.current || messages.length === 0) {
              historyListRef.current.scrollTop = historyListRef.current.scrollHeight;
              shouldScrollToBottom.current = false;
            }
            // 否则保持当前滚动位置（用户可能在浏览历史记录）
          }
        }, 100);
      } else {
        setMessages([]);
        setError("历史记录格式错误");
      }
    } catch (err) {
      console.error("加载历史记录失败:", err);
      setError("加载失败，请重试");
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }

  //--------------  Markdown 配置  --------------
  /** Markdown渲染选项 */
  const markdownOptions = {
    overrides: {
      a: {
        props: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      },
    },
  };

  //--------------  渲染  --------------
  if (!isVisible) {
    return null;
  }

  return (
    <div className="history-panel">
      {/* 内容区域 */}
      <div className="panel-content" ref={historyListRef}>
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <div className="loading-text">加载中...</div>
          </div>
        ) : error ? (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <div className="error-text">{error}</div>
            <button className="retry-btn" onClick={loadHistory}>
              重试
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💭</div>
            <div className="empty-text">暂无历史记录</div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message-item ${msg.role}`}
              >
                <div className="message-header">
                  <span className="message-role">
                    {msg.role === "user" ? "👤 你" : "🤖 AI"}
                  </span>
                  <span className="message-time">{msg.timestamp}</span>
                </div>
                <div className="message-content">
                  <Markdown options={markdownOptions}>
                    {msg.content || ""}
                  </Markdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

