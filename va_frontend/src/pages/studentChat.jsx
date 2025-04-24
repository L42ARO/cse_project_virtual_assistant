import React, { useState, useEffect, useRef } from "react";
import { useServer } from "../context/serverContext";
import { useAPI } from "../context/apiService";
import "./studentChat.css";
import CourseDropdown from "../components/CourseDropdown";
import ChatBubble from "../components/ChatBubble";
import ChatHistory from "../components/ChatHistory";
import FlaggedQuestionList from "../components/FlaggedQuestionList";
import NewChatButton from "../components/NewChatButton";
import Modal from "../components/Modal";

function StudentChat() {
    const { socket } = useServer();
    const { sccChatCont, sccChatStart, sccGetSessions, sccGetSessionMessages } = useAPI();

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const studentCourses = ["CAP6317", "CDA4213"];
    const [selectedCourse, setSelectedCourse] = useState(studentCourses[0]);

    const [chatHistory, setChatHistory] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");  // State for search query
    const [isSearchModalOpen, setSearchModalOpen] = useState(false); // State for Modal visibility
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

    // Modal related functions
    const openSearchModal = () => setSearchModalOpen(true);
    const closeSearchModal = () => setSearchModalOpen(false);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // Filter the chat history based on search query
    const filteredChatHistory = chatHistory.filter((chat) =>
        chat.course.toLowerCase().includes(searchQuery.toLowerCase())
    );

    useEffect(() => {
        const loadChatHistory = async () => {
            const token = localStorage.getItem("token");
            try {
                const result = await sccGetSessions(token, selectedCourse);

                if (result.data) {
                    const sessions = result.data.map((session) => ({
                        id: session.session_id,
                        course: session.course_id,
                        timestamp: session.timestamp,
                        thread_id: session.thread_id
                    }));
                    setChatHistory(sessions);
                } else {
                    console.error("No session data found.");
                }
            } catch (err) {
                console.error("Failed to load chat history:", err);
            }
        };

        loadChatHistory();
    }, [selectedCourse]);

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const token = localStorage.getItem("token");
        if (!hasSentInitialMessage) {
            const response = await sccChatStart("user123", selectedCourse, chatInput, token);
            if (response.data.session_id) {
                setSessionId(response.data.session_id);
                setHasSentInitialMessage(true);
            } else {
                console.error("Failed to start chat:", response.error);
            }
        } else {
            sccChatCont(socket, sessionId, chatInput, token);
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

    const handleSelectChat = async (chat) => {
        const token = localStorage.getItem("token");

        if (selectedChat && selectedChat.id === chat.id) {
            setSelectedChat(null);
            setChatMessages([]);
            setSessionId(null);
            setHasSentInitialMessage(false);
            return;
        }

        setSelectedChat(chat);
        setChatMessages([]);
        setHasSentInitialMessage(true);
        setSessionId(chat.id);

        try {
            const result = await sccGetSessionMessages(token, chat.thread_id);
            if (result.data) {
                setChatMessages(result.data);
            } else {
                console.error("Failed to fetch chat messages:", result.error);
            }
        } catch (error) {
            console.error("Error loading chat history:", error);
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
                <h2 className="student-sidebar-title">
                    Chat History
                    <button className="search-icon-button" onClick={openSearchModal}>
                        🔍
                    </button>
                </h2>
                    <NewChatButton onNewChat={handleNewChat} />
                    <ChatHistory
                        chatSessions={filteredChatHistory
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
                        value={selectedCourse}
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

            {/* Modal for search */}
            <Modal
                isOpen={isSearchModalOpen}
                onClose={closeSearchModal}
                title="Search Chats"
            >
                <div className="search-modal-body">
                    <input
                        type="text"
                        className="modal-search-input"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Search..."
                    />
                </div>
            </Modal>
        </div>
    );
}

export default StudentChat;
