// import {
//   ChevronDown,
//   PencilIcon,
//   InboxIcon,
//   PhoneIcon,
//   StarIcon,
//   BotIcon,
//   ClockIcon,
//   BarChartIcon,
//   ClipboardIcon,
//   UsersIcon,
//   TagIcon,
//   SlashIcon,
//   HelpIcon,
//   GridIcon,
// } from "./icons";

// const NAV_ITEMS = [
//   { icon: <InboxIcon />, label: "All Inboxes", active: false },
//   { icon: <BarChartIcon />, label: "Message Report", badge: "…", active: false },
//   { icon: <ClockIcon />, label: "Performance", badge: "BETA", badgeType: "beta", active: false },
//   { icon: <ClockIcon />, label: "Working Hour", badge: "BETA", badgeType: "beta", active: false },
// ];

// const MANAGE_ITEMS = [
//   { icon: <InboxIcon />, label: "All Inboxes", active: true },
//   { icon: <ClipboardIcon />, label: "Saved Replies", active: false },
//   { icon: <BotIcon />, label: "Bots (Auto Reply)", active: false },
//   { icon: <UsersIcon />, label: "Teams", active: false },
//   { icon: <UsersIcon />, label: "User Settings", active: false },
//   { icon: <TagIcon />, label: "Tags", active: false },
//   { icon: <SlashIcon />, label: "Blocked Clients", active: false },
//   { icon: <HelpIcon />, label: "Support", active: false },
//   { icon: <GridIcon />, label: "Hello Apps", active: false },
// ];

// export function Sidebar() {
//   return (
//     <aside className="sidebar">
//       <div className="sidebar-brand">
//         <div className="sidebar-brand-icon">H</div>
//         <div className="sidebar-brand-text">
//           <span className="sidebar-brand-name">Hello</span>
//           <span className="sidebar-brand-sub">shyam3</span>
//         </div>
//         <ChevronDown />
//       </div>

//       <button className="sidebar-compose">
//         <PencilIcon />
//         Compose
//       </button>

//       <ul className="sidebar-nav">
//         {NAV_ITEMS.map((item) => (
//           <li key={item.label} className={`sidebar-nav-item ${item.active ? "active" : ""}`}>
//             {item.icon}
//             <span>{item.label}</span>
//             {item.badge && (
//               <span className={`sidebar-badge ${item.badgeType || ""}`}>{item.badge}</span>
//             )}
//           </li>
//         ))}
//       </ul>

//       <div className="sidebar-divider" />
//       <p className="sidebar-section-label">Manage</p>

//       <ul className="sidebar-nav">
//         {MANAGE_ITEMS.map((item) => (
//           <li key={item.label} className={`sidebar-nav-item ${item.active ? "active" : ""}`}>
//             {item.icon}
//             <span>{item.label}</span>
//           </li>
//         ))}
//       </ul>

//       <div className="sidebar-bottom">
//         <p className="sidebar-calls-label">Incoming Calls</p>
//         <div className="sidebar-calls-select">
//           <PhoneIcon />
//           <span>Both</span>
//           <ChevronDown />
//         </div>
//         <button className="sidebar-inbox-btn">
//           <InboxIcon />
//           Go to One Inbox
//           <span style={{ marginLeft: "auto" }}>›</span>
//         </button>
//         <button className="sidebar-upgrade-btn">
//           <StarIcon />
//           Upgrade
//         </button>
//       </div>
//     </aside>
//   );
// }
