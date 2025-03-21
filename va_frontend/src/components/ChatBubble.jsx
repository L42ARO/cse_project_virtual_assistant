import React from "react";
import "./ChatBubble.css";

const ChatBubble = ({ sender, message, type }) => {
  return (
    <div className={`chat-message ${sender}`}>
      <div className="message-container">
        <div className="sender-name">{sender}</div>
        <div className="message-bubble">
          {type === "file" ? (
            <>
              📁 <span>{message}</span> {/* File icon and name */}
            </>
          ) : (
            message
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
