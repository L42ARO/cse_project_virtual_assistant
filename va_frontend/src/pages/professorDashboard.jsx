import React, { useEffect, useState, useRef } from "react";
import { useServer } from "../context/serverContext";
import { useAPI } from "../context/apiService";
import "./professorDashboard.css";
import CourseDropdown from "../components/CourseDropdown";
import ChatBubble from "../components/ChatBubble";

function ProfessorDashboard() {
    const { socket } = useServer();
    const { createNewCourse, pccChatCont, pccChatStart, pccChatIntro } = useAPI();

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [sessionId, setSessionId] = useState(null);
    const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
    const [courseId, setCourseId] = useState(null);
    const [selectedCourse, setSelectedCourse] = useState("Select a Course");

    const [lastStandbyTimestamp, setLastStandbyTimestamp] = useState(null);
    const [lastAIMessageTimestamp, setLastAIMessageTimestamp] = useState(null);

    const fileInputRef = useRef(null);
    const chatBoxRef = useRef(null);

    const [professorCourses, setProfessorCourses] = useState(["CAP6317", "CDA4213"]);

    const shouldShowStandby = lastStandbyTimestamp &&
        (!lastAIMessageTimestamp || new Date(lastStandbyTimestamp) > new Date(lastAIMessageTimestamp));

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const fileMessage = {
            message: file.name,
            sender: "Professor",
            timestamp: new Date().toISOString(),
            type: "file"
        };

        setChatMessages((prev) => [...prev, fileMessage]);

        const fileBlob = new Blob([file], { type: file.type });
        uploadFileToServer(fileBlob, file.name);
    };

    const uploadFileToServer = async (fileBlob, fileName) => {
        const formData = new FormData();
        formData.append("file", fileBlob, fileName);
        formData.append("course_id", "your_course_id");

        try {
            const response = await fetch("http://localhost:8000/pcc/upload-file", {
                method: "POST",
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                console.log("File uploaded successfully:", result.data.file_id);
            } else {
                console.error("File upload failed:", result.error);
            }
        } catch (error) {
            console.error("Error uploading file:", error);
        }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const token = localStorage.getItem("token");
        if (!hasSentInitialMessage) {
            const response = await pccChatStart("user123", selectedCourse, chatInput, token);

            if (response.data.session_id) {
                setSessionId(response.data.session_id);
                setHasSentInitialMessage(true);
            } else {
                console.error("Failed to start chat:", response.error);
                return;
            }
        } else {
            if (!sessionId) {
                console.error("No session ID set. Cannot continue chat.");
                return;
            }
            pccChatCont(socket, sessionId, chatInput, token);
        }

        setChatInput("");
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleSendMessage();
        }
    };

    const handleIncomingMessage = (data, sender) => {
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

            if (lastStandbyTimestamp && new Date(data.timestamp) > new Date(lastStandbyTimestamp)) {
                setLastStandbyTimestamp(null);
            }
        };

        const handleUserResponse = (data) => {
            handleIncomingMessage(data, "Professor");
            setChatInput("");
        };

        const handleStandby = (data) => {
            const standbyTime = new Date(data.timestamp);
            if (!lastAIMessageTimestamp || standbyTime > new Date(lastAIMessageTimestamp)) {
                setLastStandbyTimestamp(data.timestamp);
            }
        };

        socket.on("ws_pcc_ai_res", handleAIResponse);
        socket.on("ws_pcc_user_res", handleUserResponse);
        socket.on("ws_pcc_ai_stdby", handleStandby);

        return () => {
            socket.off("ws_pcc_ai_res", handleAIResponse);
            socket.off("ws_pcc_user_res", handleUserResponse);
            socket.off("ws_pcc_ai_stdby", handleStandby);
        };
    }, [socket, lastAIMessageTimestamp, lastStandbyTimestamp]);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [chatMessages, lastStandbyTimestamp]);

    useEffect(() => {
        setChatMessages([]);
        setHasSentInitialMessage(false);
        setChatInput("");
        setSessionId(null);
        setCourseId(null);
        setLastStandbyTimestamp(null);
        setLastAIMessageTimestamp(null);
        if (selectedCourse && selectedCourse !== "Select a Course") {
          const token = localStorage.getItem("token");

          if (!token) {
            console.error("No token found in localStorage");
            return;
          }

          // Send the chat intro request
          pccChatIntro(selectedCourse, token)
            .then((res) => {
              if (!res.ok) {
                console.error("Intro message failed:", res.error);
              }
            })
            .catch((err) => {
              console.error("Error in chat intro:", err);
            });
        }
    }, [selectedCourse]);

    const handleNewCourseClick = () => {
        const name = prompt("Enter Course Name (e.g., CDA3103):");
        if (!name) return;

        setProfessorCourses(prev => [...prev, name]);
        setSelectedCourse(name);
        setChatMessages([]);
        setChatInput("");
        setHasSentInitialMessage(false);

        const fakeCourseId = Date.now();
        setCourseId(fakeCourseId);
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = "/ui/login";
    };

    return (
        <div className="prof-dashboard-container">
            <div className="prof-sidebar">
                <h2 className="prof-sidebar-title">Dashboard</h2>
                <nav className="prof-nav-menu">
                    <button className="prof-nav-item">👥 Student Activity</button>
                    <button className="prof-nav-item">📝 Course Material</button>
                    <button className="prof-nav-item">⚙️ AI Settings</button>
                    <button className="prof-nav-item">🔔 Notifications</button>
                </nav>
                <button onClick={handleLogout} className="prof-logout-button">← Log out</button>
            </div>

            <div className="prof-main-content">
                <div className="prof-header">
                    <h1 className="prof-header-title">
                        {selectedCourse !== "Select a Course" ? `${selectedCourse} - Virtual Assistant` : "Virtual Assistant"}
                    </h1>
                    <CourseDropdown
                        courses={professorCourses}
                        onSelectCourse={setSelectedCourse}
                        onNewCourseClick={handleNewCourseClick}
                        showNewCourseOption={true}
                    />
                </div>

                <div className="prof-chat-box" ref={chatBoxRef}>
                    {chatMessages.map((msg, index) => (
                        <ChatBubble
                            key={index}
                            sender={msg.sender}
                            message={msg.message}
                            type={msg.type}
                        />
                    ))}

                    {shouldShowStandby && (
                        <ChatBubble
                            sender="AI"
                            message="..."
                        />
                    )}
                </div>

                <div className="prof-input-container">
                    <input
                        type="text"
                        className="prof-chat-input"
                        placeholder="Enter Question"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                    />
                    <button
                        className="prof-upload-button"
                        onClick={() => fileInputRef.current.click()}
                    >
                        ⬆️
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProfessorDashboard;
