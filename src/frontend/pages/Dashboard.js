import { useEffect, useRef, useState } from "react";
import "./homeDashboard.css";
import logo from "../../asset/logo.jpeg";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5001";
const FREE_WINDOW_DURATION_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_POLL_INTERVAL_MS = 1000;
const DASHBOARD_FETCH_TIMEOUT_MS = 5000;
const SOCKET_IO_SCRIPT_ID = "dashboard-socket-io-client-script";
const READ_COUNT_STORAGE_KEY = "dashboard-read-customer-count-v1";

function fetchWithTimeout(url, options = {}, timeoutMs = DASHBOARD_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function ticketKey(value) {
  return String(value ?? "");
}

function idsMatch(a, b) {
  return ticketKey(a) === ticketKey(b);
}

function extractUserIdFromSocketPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.userId ?? payload.user_id ?? payload.id ?? null;
}

function parseCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function loadReadCountMap() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(READ_COUNT_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const cleaned = {};
    Object.entries(parsed).forEach(([key, value]) => {
      cleaned[key] = parseCount(value);
    });
    return cleaned;
  } catch (err) {
    console.error("Failed to read unread persistence:", err);
    return {};
  }
}

function saveReadCountMap(nextMap) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(READ_COUNT_STORAGE_KEY, JSON.stringify(nextMap || {}));
  } catch (err) {
    console.error("Failed to persist unread state:", err);
  }
}

function resolveTicketId(user, index) {
  const primaryId =
    user?.id ??
    user?.user_id ??
    user?.userId ??
    user?.wa_id ??
    user?.whatsapp_id ??
    user?.contact_id;

  if (primaryId != null && String(primaryId).trim() !== "") {
    return primaryId;
  }

  const phoneLike = user?.phone ?? user?.mobile ?? user?.phone_number ?? "";
  if (String(phoneLike).trim() !== "") {
    return String(phoneLike).trim();
  }

  const nameLike = String(user?.name ?? user?.fullname ?? user?.username ?? "").trim();
  if (nameLike) {
    return `name-${nameLike.toLowerCase()}`;
  }

  return `unknown-${index}`;
}

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

function getFreeWindowState(lastCustomerMessageAt, nowMs = Date.now()) {
  if (!lastCustomerMessageAt) {
    return {
      isOpen: false,
      remainingMs: 0,
      progress: 0,
      lastCustomerMessageAt: null,
    };
  }

  const start = new Date(lastCustomerMessageAt);
  const startMs = start.getTime();

  if (Number.isNaN(startMs)) {
    return {
      isOpen: false,
      remainingMs: 0,
      progress: 0,
      lastCustomerMessageAt: null,
    };
  }

  const expiryMs = startMs + FREE_WINDOW_DURATION_MS;
  const remainingMs = Math.max(0, expiryMs - nowMs);

  return {
    isOpen: remainingMs > 0,
    remainingMs,
    progress: remainingMs / FREE_WINDOW_DURATION_MS,
    lastCustomerMessageAt: start.toISOString(),
  };
}

function getFreeWindowLabel(remainingMs) {
  if (remainingMs <= 0) {
    return { hours: 0, minutes: 0 };
  }

  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    hours: Math.min(24, Math.max(0, hours)),
    minutes: Math.max(0, minutes),
  };
}

function formatTicketTime(value) {
  if (!value) return "Just now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Just now";
  return parsed.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
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
const TrashIcon = () => <Icon d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0l1 14a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9L17 6" />;

const TABS = ["Open", "Snooze","Close", "Spam"];

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
        <div className="sidebar-brand-icon"><img src={logo} alt="logo" /> </div>

        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">FreshyZo</span>
         
        </div>
        {/* <ChevronDown /> */}
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

      {/* <div className="sidebar-bottom">
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
      </div> */}
    </aside>
  );
}

function FreeWindowTimer({ lastCustomerMessageAt, nowMs }) {
  const state = getFreeWindowState(lastCustomerMessageAt, nowMs);
  const { hours, minutes } = getFreeWindowLabel(state.remainingMs);
  const size = 72;
  const center = size / 2;
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - state.progress);

  return (
    <div className="free-window-timer" title="24-hour free chat window">
      <svg className="free-window-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="free-window-ring-track" cx={center} cy={center} r={radius} />
        <circle
          className={`free-window-ring-progress ${state.isOpen ? "open" : "closed"}`}
          cx={center}
          cy={center}
          r={radius}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: strokeOffset,
          }}
        />
      </svg>
      <div className="free-window-center">
        <strong>{hours}h</strong>
        <span>{minutes}m</span>
      </div>
    </div>
  );
}

function TicketPanel({ activeTab, setActiveTab, activeTicket, setActiveTicket, tickets, totalUnread }) {
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
            placeholder="search tickets.."
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
        {totalUnread > 0 && <span className="ticket-new-counter">{totalUnread} New</span>}
        {/* <div style={{ display: "flex", gap: 6 }}>
          <button className="ticket-filter-btn"><FilterIcon /></button>
          <button className="ticket-filter-btn"><SortIcon /></button>
        </div> */}
      </div>

      <div className="ticket-list">
        {filtered.map((ticket) => (
          <div
            key={ticket.id}
            className={`ticket-item ${ticket.active || idsMatch(activeTicket, ticket.id) ? "active" : ""} ${ticket.unread > 0 ? "unread" : ""}`}
            onClick={() => setActiveTicket(ticket.id)}
          >
            <div className="ticket-item-header">
              <div className="ticket-checkbox" />
              <span className="ticket-name">{ticket.name}</span>
              <span className="ticket-channel">
                <WhatsAppIcon />
              </span>
             <span className="ticket-time">{formatTicketTime(ticket.time)}</span>
            </div>
            <div className="ticket-preview">
              <div className="ticket-avatar">💬</div>
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

function ChatPanel({ activeTicket, ticket, messages, onSendMessage, onDeleteChat, isDeletingChat }) {
  const [input, setInput] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState(
    process.env.REACT_APP_WHATSAPP_TEMPLATE_NAME || "hello_world"
  );
  const [templateLanguage, setTemplateLanguage] = useState(
    process.env.REACT_APP_WHATSAPP_TEMPLATE_LANGUAGE || "en_US"
  );
  const messagesContainerRef = useRef(null);
  const ticketData = ticket || {};
  const referralSource = String(ticketData.source || "").trim();
  const referralVideoUrl = String(ticketData.video_url || "").trim();
  const referralThumbnailUrl = String(ticketData.thumbnail_url || "").trim();
  const referralCtwaClid = String(ticketData.ctwa_clid || "").trim();
  const hasHttpPrefix = (value) => /^https?:\/\//i.test(String(value || "").trim());
  const ticketMessages = Array.isArray(messages) ? messages : [];
  const freeWindowState = getFreeWindowState(ticketData.lastCustomerMessageAt, nowMs);
  const isFreeWindowOpen = freeWindowState.isOpen;
  
const handleInput = (e) => {
  const el = e.target;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 200) + "px";
};
  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || activeTicket == null || typeof onSendMessage !== "function") return;
    onSendMessage(trimmed, {
      isTemplate: !isFreeWindowOpen,
      templateName,
      languageCode: templateLanguage,
    });
    setInput("");
  };

  const handleInfoClick = () => {
    setIsInfoDialogOpen(true);
  };

  const handleDeleteClick = () => {
    if (activeTicket == null || typeof onDeleteChat !== "function" || isDeletingChat) return;
    onDeleteChat();
  };

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [ticketData.id, ticketMessages.length]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-avatar">
          {ticketData.name?.charAt(0) || "D"}
        
        </div>
        <div className="chat-header-info">
          <div className="chat-header-name">{ticketData.name}</div>
          <div className="chat-header-id">{ticketData.id}</div>
          <div className={`chat-window-status ${isFreeWindowOpen ? "open" : "closed"}`}>
            {isFreeWindowOpen ? "Free chat window is open" : "Free chat window expired"}
          </div>
        </div>
        
        <div className="chat-header-actions">
          {/* <button
            type="button"
            className="chat-header-btn danger"
            onClick={handleDeleteClick}
            aria-label="Delete chat"
            title="Delete this chat"
            disabled={activeTicket == null || isDeletingChat}
          >
            <TrashIcon />
          </button> */}
          <button
            type="button"
            className="chat-header-btn"
            onClick={handleInfoClick}
            aria-label="Open customer info"
          >
            <InfoCircle />
          </button>
        </div>
        <FreeWindowTimer lastCustomerMessageAt={ticketData.lastCustomerMessageAt} nowMs={nowMs} />
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
            disabled={!isFreeWindowOpen}
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
            {isFreeWindowOpen ? "Send" : "Send Template"} <SendIcon />
          </button>
        </div>
        {!isFreeWindowOpen && (
          <div className="chat-window-hint">
            <div className="chat-window-hint-text">
              24-hour window is closed. WhatsApp template is required.
            </div>
            <div className="chat-template-fields">
              <input
                className="chat-template-input"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
              />
              <input
                className="chat-template-input"
                value={templateLanguage}
                onChange={(e) => setTemplateLanguage(e.target.value)}
                placeholder="Language code (en_US)"
              />
            </div>
          </div>
        )}
      </div>

      {isInfoDialogOpen && (
        <div
          className="chat-info-dialog-backdrop"
          onClick={() => setIsInfoDialogOpen(false)}
          role="presentation"
        >
          <div
            className="chat-info-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-info-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="chat-info-dialog-title">Customer Info</h3>
            <p><strong>Name:</strong> {ticketData.name || "Unknown"}</p>
            <p><strong>Phone:</strong> {ticketData.phone || "N/A"}</p>
            <div className="chat-info-referral-block">
              <h4>Referral Data</h4>
              <p>
                <strong>Media Type :</strong> {referralSource || "N/A"}
              </p>
              <p>
                <strong>Video Url :</strong>{" "}
                {referralVideoUrl ? (
                  hasHttpPrefix(referralVideoUrl) ? (
                    <a href={referralVideoUrl} target="_blank" rel="noreferrer">
                      {referralVideoUrl}
                    </a>
                  ) : (
                    referralVideoUrl
                  )
                ) : (
                  "N/A"
                )}
              </p>
              <p>
                <strong>Thumbnail Url :</strong>{" "}
                {referralThumbnailUrl ? (
                  hasHttpPrefix(referralThumbnailUrl) ? (
                    <a href={referralThumbnailUrl} target="_blank" rel="noreferrer">
                      {referralThumbnailUrl}
                    </a>
                  ) : (
                    referralThumbnailUrl
                  )
                ) : (
                  "N/A"
                )}
              </p>
              <p>
                <strong>Ctwa Clid :</strong> {referralCtwaClid || "N/A"}
              </p>
            </div>
            <div className="chat-info-dialog-actions">
              <button type="button" className="chat-send-btn" onClick={() => setIsInfoDialogOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────
export default function HomeDashboard() {
  const [activeTab, setActiveTab] = useState("Open");
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);

  // ✅ FIXED: properly store unread state
  const [unreadByTicket, setUnreadByTicket] = useState({});
  const [pendingOutgoingByTicket, setPendingOutgoingByTicket] = useState({});
  const [readCustomerCountByTicket, setReadCustomerCountByTicket] = useState(() =>
    loadReadCountMap()
  );
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const lastCustomerSnapshotRef = useRef({});
  const pendingOutgoingByTicketRef = useRef({});
  const readCustomerCountByTicketRef = useRef(readCustomerCountByTicket);
  const ticketsRef = useRef(tickets);
  const activeTicketRef = useRef(null);
  activeTicketRef.current = activeTicket;
  pendingOutgoingByTicketRef.current = pendingOutgoingByTicket;
  readCustomerCountByTicketRef.current = readCustomerCountByTicket;
  ticketsRef.current = tickets;

  // ================== LOAD USERS ==================
  const loadUsers = () => {
    return fetchWithTimeout(`${API_BASE_URL}/users`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Users fetch failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        const mapped = Array.isArray(data)
          ? data.map((user, index) => ({
              id: resolveTicketId(user, index),
              name: user.name ?? "Unknown",
              phone: user.phone ?? "",
              source: user.source ?? "",
              video_url: user.video_url ?? "",
              thumbnail_url: user.thumbnail_url ?? "",
              ctwa_clid: user.ctwa_clid ?? "",
              channel: "whatsapp",
              time: user.last_seen ?? "",
              preview: user.last_message ?? "",
              customerMessageCount: parseCount(user.customer_message_count),
              lastCustomerMessageId: user.last_customer_message_id ?? null,
              lastCustomerMessageAt: user.last_customer_message_at ?? "",
              badge: "Bot",
              unread: 0,
            }))
          : [];

        // ✅ UNREAD LOGIC
        const nextReadMap = { ...(readCustomerCountByTicketRef.current || {}) };
        const nextUnread = {};
        const nextSnapshots = {};
        const activeTicketKey = ticketKey(activeTicketRef.current);
        const validKeys = new Set(mapped.map((ticket) => ticketKey(ticket.id)));

        mapped.forEach((ticket) => {
          const key = ticketKey(ticket.id);
          const currentCount = parseCount(ticket.customerMessageCount);
          const readCount = Math.min(parseCount(nextReadMap[key] || 0), currentCount);
          const isActive = key === activeTicketKey;

          nextReadMap[key] = isActive ? currentCount : readCount;
          nextUnread[key] = isActive ? 0 : Math.max(0, currentCount - readCount);
          nextSnapshots[key] =
            ticket.lastCustomerMessageId != null
              ? String(ticket.lastCustomerMessageId)
              : ticket.lastCustomerMessageAt
              ? String(ticket.lastCustomerMessageAt)
              : "";
        });

        Object.keys(nextReadMap).forEach((key) => {
          if (!validKeys.has(key)) {
            delete nextReadMap[key];
          }
        });

        lastCustomerSnapshotRef.current = nextSnapshots;
        setUnreadByTicket(nextUnread);
        setReadCustomerCountByTicket(nextReadMap);
        saveReadCountMap(nextReadMap);

        const mappedWithUnread = mapped.map((ticket) => ({
          ...ticket,
          unread: nextUnread[ticketKey(ticket.id)] || 0,
        }));

        setTickets(mappedWithUnread);

        // Set active ticket
        setActiveTicket((current) => {
          if (current != null && mapped.some((t) => idsMatch(t.id, current))) {
            return current;
          }
          return mapped.length > 0 ? mapped[0].id : null;
        });
      })
      .catch((err) => console.error("Fetch users failed:", err));
  };

  // ================== RESET UNREAD ==================
  useEffect(() => {
    if (activeTicket == null) return;
    const key = ticketKey(activeTicket);
    const currentTicket = ticketsRef.current.find((t) => idsMatch(t.id, activeTicket));
    const currentCount = parseCount(currentTicket?.customerMessageCount);

    setReadCustomerCountByTicket((prev) => {
      const next = {
        ...(prev || {}),
        [key]: currentCount,
      };
      saveReadCountMap(next);
      return next;
    });

    setUnreadByTicket((prev) => ({
      ...prev,
      [key]: 0,
    }));

    setTickets((prev) =>
      prev.map((t) =>
        idsMatch(t.id, activeTicket) ? { ...t, unread: 0 } : t
      )
    );
  }, [activeTicket]);

  // ================== LOAD MESSAGES ==================
  const loadMessages = (ticketId = activeTicketRef.current) => {
    if (ticketId == null) return Promise.resolve();

    return fetchWithTimeout(`${API_BASE_URL}/messages/${ticketId}`)
      .then((res) => res.json())
      .then((data) => {
        const mapped = Array.isArray(data)
          ? data.map((msg) => ({
              type: msg.sender === "admin" ? "outgoing" : "incoming",
              text: msg.message ?? "",
              createdAt: msg.created_at ?? "",
            }))
          : [];

        if (!idsMatch(ticketId, activeTicketRef.current)) {
          return;
        }

        const pendingOutgoing =
          pendingOutgoingByTicketRef.current[ticketKey(ticketId)] || [];

        const optimisticMessages = pendingOutgoing.map((pending) => ({
          type: "outgoing",
          text: pending.text,
          createdAt: pending.createdAt,
          pending: true,
          clientId: pending.clientId,
        }));

        setMessages([...mapped, ...optimisticMessages]);
      })
      .catch((err) => console.error("Fetch messages failed:", err));
  };

  // ================== EFFECTS ==================
  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadMessages();
  }, [activeTicket]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadUsers();
      if (activeTicket != null) loadMessages();
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeTicket]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    let disposed = false;
    let socket = null;
    let scriptElement = null;

    const handleIncomingSocketMessage = (payload) => {
      const sender = payload?.sender;
      const rawUserId = extractUserIdFromSocketPayload(payload);

      if (sender !== "customer" || rawUserId == null) {
        return;
      }

      const incomingTicketId = rawUserId;
      const nowIso = new Date().toISOString();
      const messageText = String(payload?.message ?? "").trim();
      const createdAt = payload?.created_at || nowIso;
      const snapshot =
        payload?.id != null
          ? String(payload.id)
          : payload?.message_id != null
          ? String(payload.message_id)
          : String(createdAt);
      const key = ticketKey(incomingTicketId);
      const isActive = idsMatch(incomingTicketId, activeTicketRef.current);

      lastCustomerSnapshotRef.current = {
        ...lastCustomerSnapshotRef.current,
        [key]: snapshot,
      };

      if (isActive) {
        setReadCustomerCountByTicket((prev) => {
          const next = {
            ...(prev || {}),
            [key]: parseCount(prev?.[key] || 0) + 1,
          };
          saveReadCountMap(next);
          return next;
        });
      }

      setUnreadByTicket((prev) => ({
        ...prev,
        [key]: isActive ? 0 : (prev[key] || 0) + 1,
      }));

      setTickets((prev) =>
        prev.map((ticket) =>
          idsMatch(ticket.id, incomingTicketId)
            ? {
                ...ticket,
                preview: messageText || ticket.preview,
                time: createdAt,
                lastCustomerMessageAt: createdAt,
                customerMessageCount: parseCount(ticket.customerMessageCount) + 1,
                lastCustomerMessageId: payload?.id ?? payload?.message_id ?? ticket.lastCustomerMessageId,
                unread: isActive ? 0 : (ticket.unread || 0) + 1,
              }
            : ticket
        )
      );

      if (isActive) {
        setMessages((prev) => [
          ...prev,
          {
            type: "incoming",
            text: messageText,
            createdAt,
          },
        ]);
      }

      loadUsers();
      if (isActive) {
        loadMessages(incomingTicketId);
      }
    };

    const connectSocket = () => {
      if (disposed || typeof window.io !== "function") {
        return;
      }

      socket = window.io(API_BASE_URL, {
        transports: ["websocket", "polling"],
      });
      socket.on("newMessage", handleIncomingSocketMessage);
    };

    if (typeof window.io === "function") {
      connectSocket();
    } else {
      const existingScript = document.getElementById(SOCKET_IO_SCRIPT_ID);

      if (existingScript) {
        scriptElement = existingScript;
        scriptElement.addEventListener("load", connectSocket);
      } else {
        const script = document.createElement("script");
        script.id = SOCKET_IO_SCRIPT_ID;
        script.src = `${API_BASE_URL}/socket.io/socket.io.js`;
        script.async = true;
        script.addEventListener("load", connectSocket);
        document.body.appendChild(script);
        scriptElement = script;
      }
    }

    return () => {
      disposed = true;
      if (scriptElement) {
        scriptElement.removeEventListener("load", connectSocket);
      }
      if (socket) {
        socket.off("newMessage", handleIncomingSocketMessage);
        socket.disconnect();
      }
    };
  }, []);

  // ================== SEND MESSAGE ==================
  const sendMessage = async (text) => {
    if (activeTicket == null) return;

    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    const targetTicket = activeTicket;
    const targetKey = ticketKey(targetTicket);
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();

    setPendingOutgoingByTicket((prev) => ({
      ...prev,
      [targetKey]: [...(prev[targetKey] || []), { clientId, text: trimmed, createdAt }],
    }));

    if (idsMatch(targetTicket, activeTicketRef.current)) {
      setMessages((prev) => [
        ...prev,
        {
          type: "outgoing",
          text: trimmed,
          createdAt,
          pending: true,
          clientId,
        },
      ]);
    }

    setTickets((prev) =>
      prev.map((ticket) =>
        idsMatch(ticket.id, targetTicket)
          ? {
              ...ticket,
              preview: trimmed,
              time: createdAt,
            }
          : ticket
      )
    );

    try {
      const response = await fetch(`${API_BASE_URL}/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: targetTicket,
          message: trimmed,
        }),
      });

      if (!response.ok) {
        throw new Error(`Send failed with status ${response.status}`);
      }

      setPendingOutgoingByTicket((prev) => {
        const next = { ...prev };
        next[targetKey] = (next[targetKey] || []).filter(
          (item) => item.clientId !== clientId
        );
        return next;
      });

      await loadUsers();
      if (idsMatch(targetTicket, activeTicketRef.current)) {
        await loadMessages(targetTicket);
      }
    } catch (err) {
      setPendingOutgoingByTicket((prev) => {
        const next = { ...prev };
        next[targetKey] = (next[targetKey] || []).filter(
          (item) => item.clientId !== clientId
        );
        return next;
      });

      if (idsMatch(targetTicket, activeTicketRef.current)) {
        await loadMessages(targetTicket);
      }

      console.error("Send message failed:", err);
    }
  };

  const deleteActiveChat = async () => {
    if (activeTicket == null || isDeletingChat) return;

    const targetTicket = activeTicket;
    const targetKey = ticketKey(targetTicket);
    const selectedTicket = ticketsRef.current.find((ticket) => idsMatch(ticket.id, targetTicket));
    const selectedName = selectedTicket?.name || "this user";
    const confirmed = window.confirm(
      `Delete chat with ${selectedName}? This will remove all messages for this user.`
    );

    if (!confirmed) return;

    setIsDeletingChat(true);

    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/chats/${encodeURIComponent(targetTicket)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        let errorMessage = `Delete failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch (_error) {
          // Ignore JSON parse failures and keep fallback error message.
        }
        throw new Error(errorMessage);
      }

      const remainingTickets = ticketsRef.current.filter(
        (ticket) => !idsMatch(ticket.id, targetTicket)
      );
      const nextActiveTicket = remainingTickets.length > 0 ? remainingTickets[0].id : null;

      setTickets(remainingTickets);
      setActiveTicket(nextActiveTicket);
      setMessages([]);

      setUnreadByTicket((prev) => {
        const next = { ...(prev || {}) };
        delete next[targetKey];
        return next;
      });

      setPendingOutgoingByTicket((prev) => {
        const next = { ...(prev || {}) };
        delete next[targetKey];
        return next;
      });

      setReadCustomerCountByTicket((prev) => {
        const next = { ...(prev || {}) };
        delete next[targetKey];
        saveReadCountMap(next);
        return next;
      });

      lastCustomerSnapshotRef.current = {
        ...(lastCustomerSnapshotRef.current || {}),
      };
      delete lastCustomerSnapshotRef.current[targetKey];

      await loadUsers();
    } catch (err) {
      console.error("Delete chat failed:", err);
      window.alert(`Unable to delete chat. ${err?.message || ""}`.trim());
    } finally {
      setIsDeletingChat(false);
    }
  };

  const activeTicketData =
    tickets.find((t) => idsMatch(t.id, activeTicket)) || {};

  const totalUnread = tickets.reduce(
    (sum, t) => sum + (t.unread || 0),
    0
  );

  return (
    <div className="dashboard">
      <Sidebar />

      <TicketPanel
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeTicket={activeTicket}
        setActiveTicket={setActiveTicket}
        tickets={tickets}
        totalUnread={totalUnread}
      />

      <ChatPanel
        activeTicket={activeTicket}
        ticket={activeTicketData}
        messages={messages}
        onSendMessage={sendMessage}
        onDeleteChat={deleteActiveChat}
        isDeletingChat={isDeletingChat}
      />
    </div>
  );
}


