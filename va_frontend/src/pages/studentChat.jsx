import React, { useEffect, useState } from "react";
import { useServer } from "../context/serverContext";
import { useAPI } from "../context/apiService";
import "./studentChat.css";
import CourseDropdown from "../components/CourseDropdown";
import ChatBubble from "../components/ChatBubble";
import ChatHistory from "../components/ChatHistory";

function StudentChat() {
    const { socket } = useServer();
    const { startChat } = useAPI();

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [selectedCourse, setSelectedCourse] = useState("Select a Course");
    const [chatHistory, setChatHistory] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);


    const studentCourses = ["CDA3103", "COP3330", "CEN4020"];

    useEffect(() => {
        // Temporary mock history (will replace with real API later)
        const mockHistory = [
            { id: 1, course: "CDA3103", timestamp: "2024-03-18T10:00:00Z" },
            { id: 2, course: "COP3330", timestamp: "2024-03-19T12:15:00Z" }
        ];
        setChatHistory(mockHistory);
    }, []);    

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

    const handleSelectChat = (chat) => {
        setSelectedChat(chat);
    
        // TODO: Load chat messages for the selected chat session from backend
        // For now, we'll just clear and simulate:
        setChatMessages([]);
        setHasSentInitialMessage(true);
        setSessionId(chat.id);  // Simulate as session ID
    };
    

    return (
        <div className="student-chat-container">
            {/* Sidebar - Chat History */}
            <ChatHistory 
                chatSessions={chatHistory} 
                onSelectChat={handleSelectChat} 
                selectedChat={selectedChat}
            />

            {/* Main Chat Section */}
            <div className="student-main-content">
                {/* Header */}
                <div className="student-header">
                    <h1 className="student-header-title">
                        {selectedCourse !== "Select a Course" ? `${selectedCourse} - Virtual Assistant` : "Virtual Assistant"}
                    </h1>
                    
                    {/* Course Dropdown */}
                    <CourseDropdown 
                        courses={studentCourses} 
                        onSelectCourse={setSelectedCourse} 
                    />
                </div>

                {/* Chat Box */}
                <div className="student-chat-box">
                    {chatMessages.map((msg, index) => (
                        <ChatBubble 
                            key={index} 
                            sender={msg.sender} 
                            message={msg.message} 
                        />
                    ))}
                </div>

                {/* Input Box */}
                <div className="student-input-container">
                    <input
                        type="text"
                        className="student-chat-input"
                        placeholder="Enter Question"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
            </div>

            {/* Sidebar - Flagged Questions */}
            <div className="student-right-sidebar">
                <h2 className="student-sidebar-title">Flagged Questions</h2>
            </div>
        </div>
    );
}

export default StudentChat;
