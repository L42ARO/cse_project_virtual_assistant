import React, { useEffect, useState, useRef } from "react";
import { useServer } from "../context/serverContext";
import { useAPI } from "../context/apiService";
import "./professorDashboard.css";

function ProfessorDashboard() {
    const { socket } = useServer();
    const { createNewCourse } = useAPI();

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
    const [courseId, setCourseId] = useState(null);

    const fileInputRef = useRef(null);

    // Handle file selection
    const handleFileUpload = (event) => {
      const file = event.target.files[0];
      if (file) {
        alert(`File "${file.name}" uploaded successfully! (Simulated)`);
      }
    };
    // Handles sending the first message
    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        if (!hasSentInitialMessage) {
            // Start a new course chat session
            const response = await createNewCourse(
                "prof123", // Replace with actual professor ID
                "some-key", // Replace with actual authentication key
                chatInput,
                "CDA3103", // Course Name
                "A", // Section
                "Spring 2025" // Term
            );

            if (response.data.course_id) {
                setCourseId(response.course_id);
                setHasSentInitialMessage(true);
            } else {
                console.error("Failed to start course chat:", response.error);
            }
        }

        setChatInput(""); // Clear input after sending
    };

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
        const handleUserResponse = (data) => handleIncomingMessage(data, "Professor");

        socket.on("ws_ai_res", handleAIResponse);
        socket.on("ws_user_res", handleUserResponse);

        return () => {
            socket.off("ws_ai_res", handleAIResponse);
            socket.off("ws_user_res", handleUserResponse);
        };
    }, [socket]);

    return (
        <div className="dashboard-container">
            {/* Sidebar */}
            <div className="sidebar">
                <h2 className="sidebar-title">Dashboard</h2>
                <nav className="nav-menu">
                    <p className="nav-item">🏠 Dashboard</p>
                    <p className="nav-item">👥 Student Activity</p>
                    <p className="nav-item">⚙️ AI Settings</p>
                    <p className="nav-item">🔔 Notifications</p>
                </nav>
                <button className="logout-button">← Log out</button>
            </div>

            {/* Main Content */}
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
                    {/* Hidden file input */}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      onChange={handleFileUpload} 
                    />

                    {/* Upload Button */}
                    <button 
                      className="upload-button" 
                      onClick={() => fileInputRef.current.click()}
                    >
                      ⬆️
                    </button>
                    {/* <button className="upload-button">⬆️</button> */}
                </div>
            </div>
        </div>
    );
}


export default ProfessorDashboard;

