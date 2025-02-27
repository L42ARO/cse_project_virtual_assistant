import React, { useEffect, useState } from "react";
import { useServer } from "../context/serverContext";
import { useAPI } from "../context/apiService";
import "./studentChat.css";

function StudentChat() {
    const { socket } = useServer();
    const { startChat } = useAPI();

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
    const [sessionId, setSessionId] = useState(null);

    // Handles sending the first message
    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        if (!hasSentInitialMessage) {
            // Start a new chat session
            const response = await startChat("user123", "course456", chatInput, "123456789");
            if (response.data.session_id) {
                setSessionId(response.session_id);
                setHasSentInitialMessage(true);
            } else {
                console.error("Failed to start chat:", response.error);
            }
        }

        setChatInput(""); // Clear input field after submission
    };
    useEffect(()=>{
        handleSendMessage();
    },[]);

    // Handle Enter Key Press
    const handleKeyDown = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleSendMessage();
        }
    };

    // Handles incoming messages and ensures correct order
    const handleIncomingMessage = (data, sender) => {
        setChatMessages((prev) => {
            const updatedMessages = [...prev, { message: data.message, sender, timestamp: data.timestamp }];
            return updatedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });
    };

    // Listen for WebSocket messages
    useEffect(() => {
        if (!socket) return;

        const handleAIResponse = (data) => handleIncomingMessage(data, "AI");
        const handleUserResponse = (data) => handleIncomingMessage(data, "User");

        socket.on("ws_ai_res", handleAIResponse);
        socket.on("ws_user_res", handleUserResponse);

        return () => {
            socket.off("ws_ai_res", handleAIResponse);
            socket.off("ws_user_res", handleUserResponse);
        };
    }, [socket]);

    return (
        <div className="chat-container">
            {/* Sidebar - Chat History */}
            <div className="sidebar">
                <h2 className="sidebar-title">Chat History</h2>
                <button className="logout-button">← Log out</button>
            </div>

            {/* Main Chat Section */}
            <div className="main-content">
                {/* Header */}
                <div className="header">
                    <h1 className="header-title">CDA3103 - Virtual Assistant</h1>
                    <div className="course-dropdown">
                        <span>Courses ▼</span>
                    </div>
                </div>

                {/* Chat Box */}
                <div className="chat-box">
                    {chatMessages.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.sender}`}>
                            <strong>{msg.sender}:</strong> {msg.message}
                        </div>
                    ))}
                </div>

                {/* Input Box */}
                <div className="input-container">
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Enter Question"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
            </div>

            {/* Sidebar - Flagged Questions */}
            <div className="right-sidebar">
                <h2 className="sidebar-title">Flagged Questions</h2>
            </div>
        </div>
    );
}

export default StudentChat;
