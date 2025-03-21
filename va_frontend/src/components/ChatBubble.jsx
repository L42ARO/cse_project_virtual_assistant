import React from "react";
import "./ChatBubble.css";

const ChatBubble = ({ sender, message, variant }) => {
  return (
    <div className={`chat-message ${sender}`}>
      <div className="message-container">
        <div className="sender-name">{sender}</div>
        <div className="message-bubble">{message}</div>
      </div>
    </div>
  );
};

export default ChatBubble;
