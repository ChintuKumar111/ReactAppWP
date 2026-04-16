import { useEffect, useRef, useState } from "react";
import "./homeDashboard.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5001";

function formatMessageTime(value) {
  if (!value) return "Now";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Now";

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toSafeDate(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  const d1 = toSafeDate(a);
  const d2 = toSafeDate(b);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getChatDateLabel(value) {
  const date = toSafeDate(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Icons (inline SVG helpers) ─────────────────────────────────────

const Icon = ({ d, size = 16, stroke = "currentColor", fill = "none", strokeWidth = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);


const PencilIcon = () => <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />;

const PhoneIcon = () => <Icon d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 5.55 5.55l.44-.44a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />;

const SearchIcon = () => <Icon d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />;

const FilterIcon = () => <Icon d="M3 4h18M7 8h10M11 12h2" strokeWidth={2} />;

const SortIcon = () => <Icon d="M3 6h18M6 12h12M10 18h4" strokeWidth={2} />;

const WhatsAppIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.563 4.138 1.547 5.872L0 24l6.272-1.516A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.842 9.842 0 0 1-5.032-1.378l-.36-.215-3.726.9.933-3.624-.236-.373A9.843 9.843 0 0 1 2.118 12C2.118 6.536 6.536 2.118 12 2.118S21.882 6.536 21.882 12 17.464 21.882 12 21.882z" />
  </svg>
);

const BotIcon = () => <Icon d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM7 14a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1zm10 0a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1z" fill="currentColor" stroke="none" />;

const InboxIcon = () => <Icon d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM2 14h20" />;
const BarChartIcon = () => <Icon d="M18 20V10M12 20V4M6 20v-6" />;

const ClockIcon = () => <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2" />;

const UsersIcon = () => <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />;

const TagIcon = () => <Icon d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />;
const SlashIcon = () => <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM4.93 4.93l14.14 14.14" />;
const HelpIcon = () => <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />;
const GridIcon = () => <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />;
const StarIcon = () => <Icon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />;
const CheckIcon = () => <Icon d="M20 6L9 17l-5-5" strokeWidth={2.5} />;
const ClipboardIcon = () => <Icon d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />;
const SendIcon = () => (<Icon d="M2 21l21-9L2 3v7l15 2-15 2z"  fill="none"   strokeWidth={2}
  />
);const ChevronDown = () => <Icon d="M6 9l6 6 6-6" />;

const DoubleCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L7 17l-5-5M22 6l-11 11" />
  </svg>
);
const SparkleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);
const InfoIcon = () => <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01" />;

const SupportIcon = () => <Icon d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0z" />


const TimerIcon = () => <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2" />;
const InfoCircle = () => <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" />;


// ─── Data ────────────────────────────────────────────────────────────
const TICKETS = [
  {
    id: 57, name: "Sachin Baghel", channel: "whatsapp", time: "7 min ago",
    preview: "oihp;inp;", badge: "CD", unread: 0, active: false
  },
  {
    id: 10798, name: "Arun", channel: "whatsapp", time: "8 min ago",
    preview: "Namaste 👋 FreshyZo mein aapka swagat hai! 🥛 Hum laa rahe hain far…",
    badge: "Bot", unread: 0, active: true
  },
  {
    id: 10797, name: "Smita Jain", channel: "whatsapp", time: "27 min ago",
    preview: "Aap FreshyZo app yahan se download kar sakte hain: 👉 https://m.9m.i…",
    badge: "Bot", unread: 7, active: false
  },
  {
    id: 3872, name: "Arun Kumar Bhatt...", channel: "whatsapp", time: "an hour ago",
    preview: "ok", badge: "PN", unread: 0, active: false
  },
  {
    id: 10669, name: "Ekta", channel: "whatsapp", time: "an hour ago",
    preview: "Aap FreshyZo app yahan se download kar sakte hain: https://m.9m.io/k…",
    badge: "Bot", unread: 9, active: false
  },
  {
    id: 10581, name: "Rahul Sharma", channel: "whatsapp", time: "2 hours ago",
    preview: "Mujhe doodh ki subscription chahiye", badge: "Bot", unread: 0, active: false
  },
];

const TICKET_MESSAGES = {
  57: {
    name: "Sachin Baghel",
    id: 57,
    messages: [
      { type: "incoming", text: "Hello, I need help with my order" },
      { type: "outgoing", text: "Sure! What's the issue?" },
      { type: "incoming", text: "I haven't received my delivery yet" },
      { type: "outgoing", text: "I apologize for the inconvenience. Let me check your order status." },
    ]
  },
  10798: {
    name: "Arun",
    id: 10798,
    messages: [
      { type: "incoming", text: "Hello, we bring fresh milk directly from farmers to your home" },
      { type: "outgoing", text: "Special Trial Offer: Pay for 3 days milk and get 3 days FREE extra!" },
      { type: "incoming", text: "This sounds great! How do I subscribe?" },
    ]
  },
  10797: {
    name: "Smita Jain",
    id: 10797,
    messages: [
      { type: "incoming", text: "You can download the FreshyZo app from the link: https://m.9m.io/app" },
      { type: "outgoing", text: "Thank you for downloading! Enjoy the offer." },
    ]
  },
  3872: {
    name: "Arun Kumar Bhatt",
    id: 3872,
    messages: [
      { type: "incoming", text: "ok" },
      { type: "outgoing", text: "Thanks for confirming!" },
    ]
  },
  10669: {
    name: "Ekta",
    id: 10669,
    messages: [
      { type: "incoming", text: "Can I get more details about the subscription?" },
      { type: "outgoing", text: "Of course! Let me share the details with you." },
    ]
  },
  10581: {
    name: "Rahul Sharma",
    id: 10581,
    messages: [
      { type: "incoming", text: "I want to subscribe for milk" },
      { type: "outgoing", text: "Sure! Which plan would you like?" },
    ]
  },
};

const TABS = ["Open", "Snooze", "Close", "Spam"];

const NAV_ITEMS = [
  { icon: <InboxIcon />, label: "All Inboxes", active: false },
  { icon: <BarChartIcon />, label: "Message Report", badge: "…", active: false },
  { icon: <ClockIcon />, label: "Performance", badge: "BETA", badgeType: "beta", active: false },
  { icon: <ClockIcon />, label: "Working Hour", badge: "BETA", badgeType: "beta", active: false },
];

const MANAGE_ITEMS = [
  { icon: <InboxIcon />, label: "All Inboxes", active: true },
  { icon: <ClipboardIcon />, label: "Saved Replies", active: false },
  { icon: <BotIcon />, label: "Bots (Auto Reply)", active: false },
  { icon: <UsersIcon />, label: "Teams", active: false },
  { icon: <UsersIcon />, label: "User Settings", active: false },
  { icon: <TagIcon />, label: "Tags", active: false },
  { icon: <SlashIcon />, label: "Blocked Clients", active: false },
  { icon: <HelpIcon />, label: "Support", active: false },
  { icon: <GridIcon />, label: "Hello Apps", active: false },
];

// ─── Components ──────────────────────────────────────────────────────

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">H</div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">Hello</span>
          <span className="sidebar-brand-sub">shyam3</span>
        </div>
        <ChevronDown />
      </div>

      <button className="sidebar-compose">
        <PencilIcon />
        Compose
      </button>

      <ul className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <li key={item.label} className={`sidebar-nav-item ${item.active ? "active" : ""}`}>
            {item.icon}
            <span>{item.label}</span>
            {item.badge && (
              <span className={`sidebar-badge ${item.badgeType || ""}`}>{item.badge}</span>
            )}
          </li>
        ))}
      </ul>

      <div className="sidebar-divider" />
      <p className="sidebar-section-label">Manage</p>

      <ul className="sidebar-nav">
        {MANAGE_ITEMS.map((item) => (
          <li key={item.label} className={`sidebar-nav-item ${item.active ? "active" : ""}`}>
            {item.icon}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <div className="sidebar-bottom">
        <p className="sidebar-calls-label">Incoming Calls</p>
        <div className="sidebar-calls-select">
          <PhoneIcon />
          <span>Both</span>
          <ChevronDown />
        </div>
        <button className="sidebar-inbox-btn">
          <InboxIcon />
          Go to One Inbox
          <span style={{ marginLeft: "auto" }}>›</span>
        </button>
        <button className="sidebar-upgrade-btn">
          <StarIcon />
          Upgrade
        </button>
      </div>
    </aside>
  );
}

function TicketPanel({ activeTab, setActiveTab, activeTicket, setActiveTicket, tickets }) {
  const [search, setSearch] = useState("");

  const filtered = (tickets || []).filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ticket-panel">
      <div className="ticket-panel-header">
        <div className="ticket-search">
          <SearchIcon />
          <input
            placeholder="Search Ticket"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ticket-tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`ticket-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="ticket-meta">
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="ticket-checkbox" />
        </label>
        <span className="ticket-count">{filtered.length} Tickets</span>
        {/* <div style={{ display: "flex", gap: 6 }}>
          <button className="ticket-filter-btn"><FilterIcon /></button>
          <button className="ticket-filter-btn"><SortIcon /></button>
        </div> */}
      </div>

      <div className="ticket-list">
        {filtered.map((ticket) => (
          <div
            key={ticket.id}
            className={`ticket-item ${ticket.active || activeTicket === ticket.id ? "active" : ""} ${ticket.unread > 0 ? "unread" : ""}`}
            onClick={() => setActiveTicket(ticket.id)}
          >
            <div className="ticket-item-header">
              <div className="ticket-checkbox" />
              <span className="ticket-name">{ticket.name}</span>
              <span className="ticket-channel">
                <WhatsAppIcon />
              </span>
             <span className="ticket-time">  
              {new Date(ticket.time).toLocaleDateString("en-GB", {
               day: "numeric",
               month: "long",
                year: "numeric",
              })}
</span>
            </div>
            <div className="ticket-preview">
              <div className="ticket-avatar">🤖</div>
              <span className="ticket-preview-text">{ticket.preview}</span>
            </div>
            <div className="ticket-footer">
              <span className="ticket-id">{ticket.id}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {ticket.unread > 0 && (
                  <span className="ticket-unread-count">{ticket.unread}</span>
                )}
                <span className={`ticket-badge ${ticket.badge.toLowerCase()}`}>{ticket.badge}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatPanel({ activeTicket, ticket, messages, onSendMessage }) {
  const [input, setInput] = useState("");
  const messagesContainerRef = useRef(null);
  const ticketData = ticket || {};
  const ticketMessages = Array.isArray(messages) ? messages : [];
  
const handleInput = (e) => {
  const el = e.target;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 200) + "px";
};
  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !activeTicket || typeof onSendMessage !== "function") return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleInfoClick = () => {
    window.alert(`Name: ${ticketData.name || "Unknown"}\nPhone: ${ticketData.phone || "N/A"}`);
  };

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [ticketData.id, ticketMessages.length]);

  return (
    <div className="chat-panel">
      {/* Header */}
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
          <button className="chat-header-btn" onClick={handleInfoClick}><InfoCircle /></button>
        </div>
      </div>

      {/* Summarize */}
      {/* <div className="chat-summarize-bar">
        <button className="summarize-btn">
          <SparkleIcon /> Summarize ▾
        </button>
      </div> */}

      {/* Messages */}
      <div className="chat-messages" ref={messagesContainerRef}>
        {ticketMessages.length === 0 && (
          <div className="chat-date-divider">
            <span>Today</span>
          </div>
        )}

        {ticketMessages.map((msg, idx) => {
          const previous = ticketMessages[idx - 1];
          const showDateDivider = idx === 0 || !isSameDay(msg.createdAt, previous?.createdAt);

          return (
            <div key={idx}>
              {showDateDivider && (
                <div className="chat-date-divider">
                  <span>{getChatDateLabel(msg.createdAt)}</span>
                </div>
              )}
              <div className="chat-message">
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
            </div>
          );
        })}
      </div>
      {/* Input Area */}
      <div className="chat-input-area">
        {/* <div className="chat-input-toolbar">
          <button className="chat-toolbar-btn"> '#' for saved replies & interactive messaTypeges</button>
          <button className="chat-toolbar-btn">'@' for agents</button>
          <button className="chat-toolbar-btn">'$' for Whatsapp template...</button>
        </div> */}
        <div className="chat-input-row">
          <textarea
            className="chat-input-box"
           placeholder="Type Message Here..."
            value={input}
            onInput={handleInput}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
          />
          <button className="chat-attach-btn">
            <svg width="16" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim()}>
            Send <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────
export default function HomeDashboard() {
  const [activeTab, setActiveTab] = useState("Open");
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [, setUnreadByTicket] = useState({});
  const lastTicketSnapshotRef = useRef({});
  const loadUsers = () => {
    fetch(`${API_BASE_URL}/users`)
      .then((res) => res.json())
      .then((data) => {
        const mapped = Array.isArray(data)
          ? data.map((user) => ({
              id: user.id ?? user.user_id ?? user.ID ?? 0,
              name: user.name ?? user.fullname ?? user.username ?? "Unknown",
              phone: user.phone ?? user.mobile ?? user.phone_number ?? "",
              channel: "whatsapp",
              time: user.last_seen ?? "just now",
              preview: user.last_message ?? "",
              lastSender: user.last_sender ?? "",
              badge: "Bot",
              unread: 0,
              active: false,
            }))
          : [];

        setUnreadByTicket((prev) => {
          const next = { ...prev };
          const nextSnapshots = { ...lastTicketSnapshotRef.current };
          const currentIds = new Set(mapped.map((ticket) => ticket.id));

          mapped.forEach((ticket) => {
            const snapshot = `${ticket.time}|${ticket.preview}|${ticket.lastSender}`;
            const previousSnapshot = lastTicketSnapshotRef.current[ticket.id];

            if (
              previousSnapshot &&
              previousSnapshot !== snapshot &&
              ticket.id !== activeTicket &&
              ticket.lastSender === "customer"
            ) {
              next[ticket.id] = (next[ticket.id] || 0) + 1;
            }

            if (next[ticket.id] == null) {
              next[ticket.id] = 0;
            }

            nextSnapshots[ticket.id] = snapshot;
          });

          Object.keys(next).forEach((id) => {
            if (!currentIds.has(Number(id))) {
              delete next[id];
            }
          });

          Object.keys(nextSnapshots).forEach((id) => {
            if (!currentIds.has(Number(id))) {
              delete nextSnapshots[id];
            }
          });

          lastTicketSnapshotRef.current = nextSnapshots;
          const mappedWithUnread = mapped.map((ticket) => ({
            ...ticket,
            unread: next[ticket.id] ?? 0,
          }));
          setTickets(mappedWithUnread);
          return next;
        });

        setActiveTicket((currentActiveTicket) => {
          if (currentActiveTicket && mapped.some((ticket) => ticket.id === currentActiveTicket)) {
            return currentActiveTicket;
          }

          return mapped.length > 0 ? mapped[0].id : null;
        });
      })
      .catch((err) => console.error("Fetch users failed:", err));
  };

  useEffect(() => {
    if (!activeTicket) return;
    setUnreadByTicket((prev) => ({ ...prev, [activeTicket]: 0 }));
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === activeTicket ? { ...ticket, unread: 0 } : ticket
      )
    );
  }, [activeTicket]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadMessages = () => {
    if (!activeTicket) return;

    fetch(`${API_BASE_URL}/messages/${activeTicket}`)
      .then((res) => res.json())
      .then((data) => {
        const mapped = Array.isArray(data)
          ? data.map((msg) => ({
              type: msg.sender === "admin" ? "outgoing" : "incoming",
              text: msg.message ?? msg.text ?? "",
              createdAt: msg.created_at ?? msg.createdAt ?? "",
            }))
          : [];
        setMessages(mapped);
      })
      .catch((err) => console.error("Fetch messages failed:", err));
  };

  useEffect(() => {
    loadMessages();
  }, [activeTicket]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadUsers();

      if (activeTicket) {
        loadMessages();
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [activeTicket]);

  const sendMessage = (messageText) => {
    if (!activeTicket || !messageText) return;
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage) return;

    const tempMessageId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage = {
      id: tempMessageId,
      type: "outgoing",
      text: trimmedMessage,
      createdAt: new Date().toISOString(),
      isPending: true,
    };

    // Render immediately so sending feels instant in the dashboard.
    setMessages((prev) => [...prev, optimisticMessage]);

    fetch(`${API_BASE_URL}/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: activeTicket, message: trimmedMessage }),
    })
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Message send failed.");
        }

        return data;
      })
      .then((data) => {
        if (data.success) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempMessageId ? { ...msg, isPending: false } : msg
            )
          );
          loadUsers();
        }
      })
      .catch((err) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
        console.error("Send message failed:", err);
        window.alert(err.message || "Message send failed.");
      });
  };

  const activeTicketData = tickets.find((ticket) => ticket.id === activeTicket) || { id: activeTicket, name: "Unknown" };

  return (
    <div className="dashboard">
      <Sidebar />
      <TicketPanel
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeTicket={activeTicket}
        setActiveTicket={setActiveTicket}
        tickets={tickets}
      />
      <ChatPanel
        activeTicket={activeTicket}
        ticket={activeTicketData}
        messages={messages}
        onSendMessage={sendMessage}
      />
    </div>
  );
}

