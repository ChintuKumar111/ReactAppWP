import { useState } from "react";
import {
  PhoneIcon,
  BotIcon,
  TagIcon,
  TimerIcon,
  CheckIcon,
  InfoCircle,
  WhatsAppIcon,
  SparkleIcon,
  SendIcon,
  DoubleCheck,
} from "./icons";

function formatMessageTime(value) {
  if (!value) return "Now";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Now";

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPanel({ activeTicket, ticket, messages, onSendMessage }) {
  const [input, setInput] = useState("");
  const ticketData = ticket || {};
  const ticketMessages = Array.isArray(messages) ? messages : [];

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !activeTicket || typeof onSendMessage !== "function") return;
    onSendMessage(trimmed);
    setInput("");
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-avatar">
          {ticketData.name?.charAt(0) || "D"}
          <span className="chat-header-avatar-badge">😊</span>
        </div>
        <div className="chat-header-info">
          <div className="chat-header-name">{ticketData.name}</div>
          <div className="chat-header-id">{ticketData.id}</div>
        </div>
        <div className="chat-header-actions">
          <button className="chat-header-btn green">
            <PhoneIcon />
          </button>
          <div className="bot-badge">
            <BotIcon />
            Bot
          </div>
          <button className="chat-header-btn"><TagIcon /></button>
          <button className="chat-header-btn"><TimerIcon /></button>
          <button className="chat-header-btn"><CheckIcon /></button>
          <button className="chat-header-btn"><InfoCircle /></button>
        </div>
      </div>

      <div className="chat-messages">
        <div className="chat-date-divider">
          <span>Today</span>
        </div>

        {ticketMessages.map((msg, idx) => (
          <div key={idx} className="chat-message">
            {msg.type === "incoming" && (
              <>
                <div className="chat-bubble-label">👤 Customer</div>
                <div className="chat-bubble incoming">
                  <p>{msg.text}</p>
                  <div className="chat-bubble-meta">
                    <span className="chat-bubble-time">{formatMessageTime(msg.createdAt)}</span>
                  </div>
                </div>
              </>
            )}
            {msg.type === "outgoing" && (
              <div className="chat-bubble outgoing">
                <p>{msg.text}</p>
                <div className="chat-bubble-meta">
                  <span className="chat-bubble-time">{formatMessageTime(msg.createdAt)}</span>
                  <DoubleCheck />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="chat-input-area">
        <div className="chat-input-toolbar">
          <button className="chat-toolbar-btn">Type '#' for saved replies & interactive messages</button>
          <button className="chat-toolbar-btn">'@' for agents</button>
          <button className="chat-toolbar-btn">'$' for Whatsapp template...</button>
        </div>
        <div className="chat-input-row">
          <textarea
            className="chat-input-box"
            placeholder="Type '#' for saved replies & interactive messages, '@' for agents, '$' for Whatsapp template..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
          />
          <button className="chat-attach-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
        </div>
        <div className="chat-input-footer">
          <div className="chat-channel-badge">
            <WhatsAppIcon />
            WhatsApp
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span className="chat-ai-reply">
              <SparkleIcon />
              AI reply
            </span>
            <span className="chat-shortcut">Ctrl + Enter to</span>
            <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim()}>
              Send <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
