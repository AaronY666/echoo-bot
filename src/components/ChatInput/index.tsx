import React from "react";
import "./index.scss";

export interface ChatInputProps {
  /** 输入框的值 */
  value: string;
  /** 输入变化回调 */
  onChange: (value: string) => void;
  /** 发送消息回调 */
  onSend: () => void;
  /** 关闭输入框回调 */
  onClose: () => void;
  /** 切换历史记录显示 */
  onToggleHistory: () => void;
  /** 是否显示历史记录 */
  showHistory: boolean;
  /** 是否禁用发送（思考中） */
  disabled?: boolean;
}

/**
 * 聊天输入框组件 - 支持输入、发送、切换历史模式
 */
export function ChatInput({
  value,
  onChange,
  onSend,
  onClose,
  onToggleHistory,
  showHistory,
  disabled = false,
}: ChatInputProps) {
  /** 处理回车发送 */
  function handleKeyPress(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="chat-input-container">
      <textarea
        className="chat-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="和我聊天吧... (Enter发送, Shift+Enter换行)"
        rows={2}
      />
      <div className="button-group">
        <button
          className={`history-btn ${showHistory ? "active" : ""}`}
          onClick={onToggleHistory}
          title={showHistory ? "隐藏历史记录" : "显示历史记录"}
        >
          {showHistory ? "📖" : "📜"}
        </button>
        <button
          className="close-input-btn"
          onClick={onClose}
          title="关闭输入框"
        >
          关闭
        </button>
        <button
          className="send-btn"
          onClick={onSend}
          disabled={!value.trim() || disabled}
        >
          {disabled ? "⏳" : "发送"}
        </button>
      </div>
    </div>
  );
}

