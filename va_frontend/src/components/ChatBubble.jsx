import React from "react";
import ReactMarkdown from "react-markdown";
import "./ChatBubble.css";

const ChatBubble = ({ sender, message, type }) => {
  return (
    <div className={`chat-message ${sender}`}>
      <div className="message-container">
        <div className="sender-name">{sender}</div>
        <div className="message-bubble">
          {type === "file" ? (
            <>
              📁 <span>{message}</span>
            </>
          ) : (
            <ReactMarkdown>{message}</ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
