import React from "react";
import "./ChatHistory.css"; // Import styles if needed

const ChatHistory = ({ chatSessions, onSelectChat, selectedChat }) => {
  return (
    <div className="chat-history-container">
      <h2 className="chat-history-title">Chat History</h2>
      <ul className="chat-history-list">
        {chatSessions.length > 0 ? (
          chatSessions.map((chat) => (
            <li
              key={chat.id}
              className={`chat-history-item ${
                selectedChat?.id === chat.id ? "selected" : ""
              }`}
              onClick={() => onSelectChat(chat)}
            >
              {chat.course} - {new Date(chat.timestamp).toLocaleString()}
            </li>
          ))
        ) : (
          <p className="no-chats">No previous chats</p>
        )}
      </ul>
    </div>
  );
};

export default ChatHistory;
