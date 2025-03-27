import React from "react";
import "./NewChatButton.css";

const NewChatButton = ({ onNewChat }) => {
    return (
        <button className="new-chat-button" onClick={onNewChat}>
            ＋ New Chat
        </button>
    );
};

export default NewChatButton;
