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
    const { sccChatCont, sccChatStart } = useAPI();

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [selectedCourse, setSelectedCourse] = useState("Select a Course");
    const [chatHistory, setChatHistory] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const chatBoxRef = useRef(null);
    const [lastStandbyTimestamp, setLastStandbyTimestamp] = useState(null);
    const [lastAIMessageTimestamp, setLastAIMessageTimestamp] = useState(null);

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

    const studentCourses = ["CAP6317", "CDA3103", "COP3330", "CEN4020"];

    useEffect(() => {
        const mockHistory = [
            { id: 1, course: "CDA3103", timestamp: "2024-03-18T10:00:00Z" },
            { id: 2, course: "COP3330", timestamp: "2024-03-19T12:15:00Z" }
        ];
        setChatHistory(mockHistory);
    }, []);

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        if (!hasSentInitialMessage) {
            const response = await sccChatStart("user123", selectedCourse, chatInput, "12341235");
            if (response.data.session_id) {
                setSessionId(response.data.session_id);
                setHasSentInitialMessage(true);
            } else {
                console.error("Failed to start chat:", response.error);
            }
        } else {
            sccChatCont(socket, sessionId, chatInput, "123456789");
        }
    };

    useEffect(() => {
        handleSendMessage();
    }, []);

    const handleKeyDown = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleSendMessage();
        }
    };

    const handleIncomingMessage = (data, sender) => {
        if (data.failed) {
            console.error(data.details);
        }

        const newMessage = {
            message: data.message,
            sender,
            timestamp: data.timestamp
        };

        setChatMessages((prev) => {
            const updatedMessages = [...prev, newMessage];
            return updatedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });
    };

    useEffect(() => {
        if (!socket) return;

        const handleAIResponse = (data) => {
            handleIncomingMessage(data, "AI");
            setLastAIMessageTimestamp(data.timestamp);

            // If AI response is after standby, clear standby
            if (lastStandbyTimestamp && new Date(data.timestamp) > new Date(lastStandbyTimestamp)) {
                setLastStandbyTimestamp(null);
            }
        };

        const handleUserResponse = (data) => {
            handleIncomingMessage(data, "User");
            setChatInput("");
        };

        const handleStandby = (data) => {
            const standbyTime = new Date(data.timestamp);
            if (!lastAIMessageTimestamp || standbyTime > new Date(lastAIMessageTimestamp)) {
                setLastStandbyTimestamp(data.timestamp);
            }
        };

        socket.on("ws_scc_ai_res", handleAIResponse);
        socket.on("ws_scc_user_res", handleUserResponse);
        socket.on("ws_scc_ai_stdby", handleStandby);

        return () => {
            socket.off("ws_scc_ai_res", handleAIResponse);
            socket.off("ws_scc_user_res", handleUserResponse);
            socket.off("ws_scc_ai_stdby", handleStandby);
        };
    }, [socket, lastAIMessageTimestamp, lastStandbyTimestamp]);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [chatMessages, lastStandbyTimestamp]);

    useEffect(() => {
        setSelectedChat(null);
        setChatMessages([]);
        setSessionId(null);
        setHasSentInitialMessage(false);
        setChatInput("");
        setLastStandbyTimestamp(null);
        setLastAIMessageTimestamp(null);
    }, [selectedCourse]);

    const handleSelectChat = (chat) => {
        setSelectedChat(chat);

        if (selectedChat && selectedChat.id === chat.id) {
            setSelectedChat(null);
            setChatMessages([]);
            setSessionId(null);
            setHasSentInitialMessage(false);
        } else {
            setSelectedChat(chat);
            setChatMessages([]);
            setHasSentInitialMessage(true);
            setSessionId(chat.id);
        }
    };

    const handleNewChat = () => {
        if (selectedCourse === "Select a Course") {
            alert("Please select a course before starting a new chat.");
            return;
        }

        setSelectedChat(null);
        setChatMessages([]);
        setSessionId(null);
        setHasSentInitialMessage(false);
        setChatInput("");
        setLastStandbyTimestamp(null);
        setLastAIMessageTimestamp(null);

        const newChatId = Date.now();
        const newChat = {
            id: newChatId,
            course: selectedCourse,
            timestamp: new Date().toISOString()
        };

        setChatHistory(prev => [...prev, newChat]);
        setSessionId(newChatId);
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = "/ui/login";
    };

    const shouldShowStandby = lastStandbyTimestamp &&
        (!lastAIMessageTimestamp || new Date(lastStandbyTimestamp) > new Date(lastAIMessageTimestamp));

    return (
        <div className="student-chat-container">
            <div className="student-left-sidebar">
                <div className="student-sidebar-content">
                    <h2 className="student-sidebar-title">Chat History</h2>
                    <NewChatButton onNewChat={handleNewChat} />
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
                <div className="student-header">
                    <h1 className="student-header-title">
                        {selectedCourse !== "Select a Course" ? `${selectedCourse} - Virtual Assistant` : "Virtual Assistant"}
                    </h1>
                    <CourseDropdown
                        courses={studentCourses}
                        onSelectCourse={setSelectedCourse}
                    />
                </div>

                <div className="student-chat-box" ref={chatBoxRef}>
                    {chatMessages.map((msg, index) => (
                        <ChatBubble
                            key={index}
                            sender={msg.sender}
                            message={msg.message}
                        />
                    ))}

                    {shouldShowStandby && (
                        <ChatBubble
                            sender="AI"
                            message="..."
                        />
                    )}

                </div>

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

            <div className="student-right-sidebar">
                <h2 className="student-sidebar-title">Flagged Questions</h2>
                <FlaggedQuestionList flaggedQuestions={filteredFlaggedQuestions} />
            </div>
        </div>
    );
}

export default StudentChat;
