// import { useState } from "react";
// import { SearchIcon, FilterIcon, SortIcon, WhatsAppIcon } from "./icons";

// export function TicketPanel({ activeTab, setActiveTab, activeTicket, setActiveTicket, tickets, tabs = [] }) {
//   const [search, setSearch] = useState("");

//   const filtered = (tickets || []).filter((t) =>
//     t.name.toLowerCase().includes(search.toLowerCase())
//   );

//   return (
//     <div className="ticket-panel">
//       <div className="ticket-panel-header">
//         <div className="ticket-search">
//           <SearchIcon />
//           <input
//             placeholder="Search Ticket"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//           />
//         </div>
//         <div className="ticket-tabs">
//           {tabs.map((tab) => (
//             <button
//               key={tab}
//               className={`ticket-tab ${activeTab === tab ? "active" : ""}`}
//               onClick={() => setActiveTab(tab)}
//             >
//               {tab}
//             </button>
//           ))}
//         </div>
//       </div>

//       <div className="ticket-meta">
//         <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
//           <div className="ticket-checkbox" />
//         </label>
//         <span className="ticket-count">{filtered.length} Tickets</span>
//         <div style={{ display: "flex", gap: 6 }}>
//           <button className="ticket-filter-btn"><FilterIcon /></button>
//           <button className="ticket-filter-btn"><SortIcon /></button>
//         </div>
//       </div>

//       <div className="ticket-list">
//         {filtered.map((ticket) => (
//           <div
//             key={ticket.id}
//             className={`ticket-item ${ticket.active || activeTicket === ticket.id ? "active" : ""} ${ticket.unread > 0 ? "unread" : ""}`}
//             onClick={() => setActiveTicket(ticket.id)}
//           >
//             <div className="ticket-item-header">
//               <div className="ticket-checkbox" />
//               <span className="ticket-name">{ticket.name}</span>
//               <span className="ticket-channel">
//                 <WhatsAppIcon />
//               </span>
//               <span className="ticket-time">{ticket.time}</span>
//             </div>
//             <div className="ticket-preview">
//               <div className="ticket-avatar">🤖</div>
//               <span className="ticket-preview-text">{ticket.preview}</span>
//             </div>
//             <div className="ticket-footer">
//               <span className="ticket-id">{ticket.id}</span>
//               <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
//                 {ticket.unread > 0 && (
//                   <span className="ticket-unread-count">{ticket.unread}</span>
//                 )}
//                 <span className={`ticket-badge ${ticket.badge.toLowerCase()}`}>{ticket.badge}</span>
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }
