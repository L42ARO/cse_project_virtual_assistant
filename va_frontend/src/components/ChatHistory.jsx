import React from "react";
import "./ChatHistory.css"; // Import styles if needed


const ChatHistory = ({ chatSessions, onSelectChat, selectedChat }) => {
  return (
    <div className="chat-history-container">
      {/* Title of the chat history section */}
      <h2 className="chat-history-title">Chat History</h2>

      {/* Unordered list to show the chat items */}
      <ul className="chat-history-list">
        {/* Check if there are any chat sessions to display */}
        {chatSessions.length > 0 ? (
          // If there are chats, map through them and render each one
          chatSessions.map((chat) => (
            <li
              key={chat.id} // Unique key for React to optimize rendering
              className={`chat-history-item ${
                selectedChat?.id === chat.id ? "selected" : ""
              }`} // Add 'selected' class if this chat is currently selected
              onClick={() => onSelectChat(chat)} // Handle chat selection when clicked
            >
              {/* Display course name and formatted timestamp */}
              {chat.course} - {new Date(chat.timestamp).toLocaleString()}
            </li>
          ))
        ) : (
          // If there are no chats, show a message
          <p className="no-chats">No previous chats</p>
        )}
      </ul>
    </div>
  );
};
  
export default ChatHistory;
