import React from "react";
import "./ChatHistory.css";

const ChatHistory = ({ chatSessions, onSelectChat, selectedChat }) => {
  // helper to parse either a number (seconds) or a string (ISO)
  const parseDate = (ts) => {
    if (ts == null) return null;
    // if it's purely digits (or a number), treat as Unix seconds
    if (typeof ts === "number" || /^\d+$/.test(ts)) {
      const n = Number(ts);
      // if it looks like seconds (e.g. <1e12), multiply; else assume ms
      return new Date(n < 1e12 ? n * 1000 : n);
    }
    // otherwise assume an ISO date string
    return new Date(ts);
  };

  return (
    <div className="chat-history-container">
      <ul className="chat-history-list">
        {chatSessions.length > 0 ? (
          chatSessions.map((chat) => {
            const dateObj = parseDate(chat.timestamp);
            const label = dateObj && !isNaN(dateObj)
              ? dateObj.toLocaleString()
              : "Invalid Date";

            return (
              <li
                key={chat.id}
                className={`chat-history-item ${
                  selectedChat?.id === chat.id ? "selected" : ""
                }`}
                onClick={() => onSelectChat(chat)}
              >
                {chat.course} – {label}
              </li>
            );
          })
        ) : (
          <p className="no-chats">No previous chats</p>
        )}
      </ul>
    </div>
  );
};

export default ChatHistory;
