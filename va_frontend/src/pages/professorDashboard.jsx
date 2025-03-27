import React, { useEffect, useState, useRef } from "react";
import { useServer } from "../context/serverContext";
import { useAPI } from "../context/apiService";
import "./professorDashboard.css";
import CourseDropdown from "../components/CourseDropdown";
import ChatBubble from "../components/ChatBubble";
import PopupModal from "../components/PopupModal";

function ProfessorDashboard() {
    const { socket } = useServer();
    const { createNewCourse, pccContChat } = useAPI();

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
    const [courseId, setCourseId] = useState(null);
    const [selectedCourse, setSelectedCourse] = useState("Select a Course");

    const fileInputRef = useRef(null); // Reference to file input element
 
    const chatBoxRef = useRef(null); // Reference to chat box div

    const [professorCourses, setProfessorCourses] = useState(["CDA3103", "COP3330", "CEN4020"]);

    const [activePopup, setActivePopup] = useState(null);

    const openPopup = (type) => setActivePopup(type);
    const closePopup = () => setActivePopup(null);

    const mockCourseFiles = {
        CDA3103: ["Lecture1.pdf", "Pipelining_Notes.docx"],
        COP3330: ["Assignment1.java", "OOP_Concepts.pdf"],
        CEN4020: ["Project_Guidelines.pdf"]
      };

    const [aiSettings, setAISettings] = useState("Summarize before answering");

      

    // Handle file selection
    const handleFileUpload = (event) => {
        const file = event.target.files[0];

        if (!file) return;

        // Create a file message object
        const fileMessage = {
            message: file.name,  // Display the file name
            sender: "Professor",
            timestamp: new Date().toISOString(),
            type: "file"  // Mark it as a file type
        };

        // Add the file message to chat history
        setChatMessages((prev) => [...prev, fileMessage]);


        // Convert the file to a blob and upload it to the server
        const fileBlob = new Blob([file], { type: file.type });
        uploadFileToServer(fileBlob, file.name);
    };

    const uploadFileToServer = async (fileBlob, fileName) => {
        const formData = new FormData();
        formData.append("file", fileBlob, fileName);
        formData.append("course_id", "your_course_id");  // Replace with actual course ID

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
        else{
            const response = pccContChat(socket, "12341234", chatInput, "123456789")
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

        socket.on("ws_pcc_ai_res", handleAIResponse);
        socket.on("ws_pcc_user_res", handleUserResponse);

        return () => {
            socket.off("ws_pcc_ai_res", handleAIResponse);
            socket.off("ws_pcc_user_res", handleUserResponse);
        };
    }, [socket]);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [chatMessages]);
    

    useEffect(() => {
            // Reset chat-related state when course is changed
            setChatMessages([]);
            setHasSentInitialMessage(false);
            setChatInput("");
        }, [selectedCourse]); 

    const handleNewCourseClick = () => {
        const name = prompt("Enter Course Name (e.g., CDA3103):");
        if (!name) return;
        
        // Optional: you can also ask for section/term here if needed
        
        // Add to dropdown list
        setProfessorCourses(prev => [...prev, name]);
        
        // Automatically select the new course
        setSelectedCourse(name);
        
        // Reset chat and input
        setChatMessages([]);
        setChatInput("");
        setHasSentInitialMessage(false);
        
        // Optionally simulate a course ID
        const fakeCourseId = Date.now();
        setCourseId(fakeCourseId);
        };
          

    const handleLogout = () => {
        // Clear auth-related items from localStorage
        localStorage.clear();
    
        // Redirect to login
        window.location.href = "/ui/login";
    };

    return (
        <div className="prof-dashboard-container">
            {/* Sidebar */}
            <div className="prof-sidebar">
                <h2 className="prof-sidebar-title">Dashboard</h2>
                <nav className="prof-nav-menu">
                    <button className="prof-nav-item" onClick={() => openPopup("studentActivity")}>👥 Student Activity</button>
                    <button className="prof-nav-item" onClick={() => openPopup("courseMaterial")}>📝 Course Material</button>
                    <button className="prof-nav-item" onClick={() => openPopup("aiSettings")}>⚙️ AI Settings</button>
                    <button className="prof-nav-item" onClick={() => openPopup("notifications")}>🔔 Notifications</button>
                </nav>
                <button onClick={handleLogout} className="prof-logout-button">← Log out</button>
            </div>

            {/* Main Content */}
            <div className="prof-main-content">
                {/* Header */}
                <div className="prof-header">
                    <h1 className="prof-header-title">
                        {selectedCourse !== "Select a Course" ? `${selectedCourse} - Virtual Assistant` : "Virtual Assistant"}
                    </h1>

                    {/* Course Dropdown */}
                    <CourseDropdown
                        courses={professorCourses}
                        onSelectCourse={setSelectedCourse}
                        onNewCourseClick={handleNewCourseClick}
                        showNewCourseOption={true}
                    />
                </div>

                {/* Chat Box */}
                <div className="prof-chat-box" ref={chatBoxRef}>
                    {chatMessages.map((msg, index) => (
                        <ChatBubble 
                            key={index} 
                            sender={msg.sender} 
                            message={msg.message} 
                            type={msg.type} 
                        />
                    ))}
                </div>

                {/* Input Box */}
                <div className="prof-input-container">
                    <input
                        type="text"
                        className="prof-chat-input"
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
                      className="prof-upload-button" 
                      onClick={() => fileInputRef.current.click()}
                    >
                      ⬆️
                    </button>
                    {/* <button className="upload-button">⬆️</button> */}
                </div>
            </div>
            {/* Popup Modal */}
            {activePopup === "courseMaterial" && (
                <PopupModal title="Course Material" onClose={closePopup}>
                    {selectedCourse !== "Select a Course" ? (
                    <ul>
                        {(mockCourseFiles[selectedCourse] || []).map((file, idx) => (
                        <li key={idx}>{file}</li>
                        ))}
                    </ul>
                    ) : (
                    <p>Please select a course first.</p>
                    )}
                </PopupModal>
                )}

                {activePopup === "aiSettings" && (
                <PopupModal title="AI Settings" onClose={closePopup}>
                    <textarea
                    className="ai-settings-textarea"
                    value={aiSettings}
                    onChange={(e) => setAISettings(e.target.value)}
                    rows={4}
                    />
                    <button
                    className="ai-settings-save-button"
                    onClick={() => {
                        // future: send `aiSettings` to backend
                        closePopup();
                    }}
                    >
                    Save Settings
                    </button>
                </PopupModal>
                )}
        </div>
    );
}


export default ProfessorDashboard;

