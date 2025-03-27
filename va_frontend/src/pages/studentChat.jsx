import React, { useEffect, useState, useRef } from "react";
import { useServer } from "../context/serverContext";
import { useAPI } from "../context/apiService";
import "./studentChat.css";
import CourseDropdown from "../components/CourseDropdown";
import ChatBubble from "../components/ChatBubble";
import ChatHistory from "../components/ChatHistory";
import FlaggedQuestionList from "../components/FlaggedQuestionList";
import NewChatButton from "../components/NewChatButton";

function StudentChat() {
    const { socket } = useServer();
    const { sccContChat, sccStartChat } = useAPI();

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [selectedCourse, setSelectedCourse] = useState("Select a Course");
    const [chatHistory, setChatHistory] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const chatBoxRef = useRef(null); 
    const [flaggedQuestions, setFlaggedQuestions] = useState([
        {
            id: 1,
            question: "Can you explain pipelining again?",
            sentToProfessor: true,
            professorReply: "Sure! Pipelining allows overlapping instruction execution.",
            course: "CDA3103"
        },
        {
            id: 2,
            question: "Why does my code get a null pointer?",
            sentToProfessor: true,
            professorReply: null,
            course: "COP3330"
        }
    ]);
    const filteredFlaggedQuestions = flaggedQuestions.filter(
        (q) => q.course === selectedCourse
    );

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
            const response = await sccStartChat("user123", "course456", chatInput, "123456789");
            if (response.data.session_id) {
                setSessionId(response.session_id);
                setHasSentInitialMessage(true);
            } else {
                console.error("Failed to start chat:", response.error);
            }
        }
        else{
            const response = sccContChat(socket,"123456", chatInput, "123456789");
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

        socket.on("ws_scc_ai_res", handleAIResponse);
        socket.on("ws_scc_user_res", handleUserResponse);

        return () => {
            socket.off("ws_scc_ai_res", handleAIResponse);
            socket.off("ws_scc_user_res", handleUserResponse);
        };
    }, [socket]);

    // handle scroll to bottom of chat box
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [chatMessages]);
    
    // Reset chat-related state when course is changed
    useEffect(() => {
        setSelectedChat(null);
        setChatMessages([]);
        setSessionId(null);
        setHasSentInitialMessage(false);
        setChatInput("");
    }, [selectedCourse]); 

    // Handle selecting and deselecting a chat session
    const handleSelectChat = (chat) => {
        setSelectedChat(chat);
    
        // TODO: Load chat messages for the selected chat session from backend
        // For now, we'll just clear and simulate:
        if (selectedChat && selectedChat.id === chat.id) {
            // Unselect if same chat is clicked again
            setSelectedChat(null);
            setChatMessages([]);
            setSessionId(null);
            setHasSentInitialMessage(false);
        } else {
            setSelectedChat(chat);
            setChatMessages([]);
            setHasSentInitialMessage(true);
            setSessionId(chat.id);  // Simulate as session ID
        }
    };

    // Handle starting a new chat session
    const handleNewChat = () => {
        if (selectedCourse === "Select a Course") {
            alert("Please select a course before starting a new chat.");
            return;
        }
    
        // Start fresh session
        setSelectedChat(null);
        setChatMessages([]);
        setSessionId(null);
        setHasSentInitialMessage(false);
        setChatInput("");
    
        // Optionally generate a new chat ID
        const newChatId = Date.now(); // use this to simulate a new session
    
        // Add to chat history
        const newChat = {
            id: newChatId,
            course: selectedCourse,
            timestamp: new Date().toISOString()
        };
    
        setChatHistory(prev => [...prev, newChat]);
        setSessionId(newChatId); // simulate the session ID until backend is ready
    };

    // Handle logging out
    const handleLogout = () => {
        // Clear auth-related items from localStorage
        localStorage.clear();
    
        // Redirect to login
        window.location.href = "/ui/login";
    };

    return (
        <div className="student-chat-container">
            {/* Main Chat Section */}
            <div className="student-left-sidebar">
                <div className="student-sidebar-content">
                    {/* Title of the chat history section */}
                    <h2 className="student-sidebar-title">Chat History</h2>

                    {/* New Chat Button */}
                    <NewChatButton onNewChat={handleNewChat} />

                    {/* Sidebar - Chat History */}
                    <ChatHistory 
                        chatSessions={chatHistory
                            .filter(chat => chat.course === selectedCourse)
                            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))}
                        onSelectChat={handleSelectChat} 
                        selectedChat={selectedChat}
                    />
                </div>
                <button onClick={handleLogout} className="student-logout-button"> ← Log out </button>
            </div>

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
                <div className="student-chat-box" ref={chatBoxRef}>
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
                <FlaggedQuestionList flaggedQuestions={filteredFlaggedQuestions} />
            </div>
        </div>
    );
}

export default StudentChat;
