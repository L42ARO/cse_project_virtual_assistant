import React, { useEffect, useState, useRef } from "react";
import { useServer } from "../context/serverContext";
import { useAPI } from "../context/apiService";
import "./professorDashboard.css";
import CourseDropdown from "../components/CourseDropdown";
import ChatBubble from "../components/ChatBubble";
import Modal from "../components/Modal";

function ProfessorDashboard() {
    const { socket } = useServer();
    const { createNewCourse, pccChatCont, pccChatStart, pccChatIntro } = useAPI();

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [sessionId, setSessionId] = useState(null);
    const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
    const [courseId, setCourseId] = useState(null);
    const [professorCourses, setProfessorCourses] = useState(["CAP6317", "CDA4213"]);
    const [selectedCourse, setSelectedCourse] = useState(professorCourses[0]);

    const [lastStandbyTimestamp, setLastStandbyTimestamp] = useState(null);
    const [lastAIMessageTimestamp, setLastAIMessageTimestamp] = useState(null);

    const fileInputRef = useRef(null);
    const chatBoxRef = useRef(null);

    // Dummy flagged data 
    const dummyFlaggedData = {
        mandatory: [
            {
                id: "m1",
                course_id: "CAP6317",
                question: "Why is AI alignment important?",
                reason: "High-risk topic",
                timestamp: "2025-04-10T10:00:00Z",
                seen: false
            },
            {
                id: "m2",
                course_id: "CAP6317",
                question: "What ethical risks exist in training LLMs?",
                reason: "Sensitive subject",
                timestamp: "2025-04-11T14:30:00Z",
                seen: true
            },
            {
                id: "m3",
                course_id: "CDA4213",
                question: "Can you explain the risks of overclocking a CPU?",
                reason: "Hardware risk",
                timestamp: "2025-04-13T09:15:00Z",
                seen: false
            },
        ],
        voluntary: [
            {
                id: "v1",
                course_id: "CAP6317",
                question: "Can you elaborate on transformer models?",
                reason: "Student request",
                timestamp: "2025-04-12T15:23:00Z",
                seen: false
            },
            {
                id: "v2",
                course_id: "CAP6317",
                question: "How does backpropagation work?",
                reason: "Needs clarification",
                timestamp: "2025-04-13T16:40:00Z",
                seen: true
            },
            {
                id: "v3",
                course_id: "CDA4213",
                question: "Can you revisit the topic of pipelining?",
                reason: "Missed class",
                timestamp: "2025-04-14T10:00:00Z",
                seen: true
            }
        ]
    };   


    const [modalType, setModalType] = useState(null);
    const [flaggedData, setFlaggedData] = useState(dummyFlaggedData);
    const [showSeen, setShowSeen] = useState(false);
    const openModal = (type) => {setModalType(type)};
    const closeModal = () => setModalType(null);

    const dummyCourseMaterials = {
        CAP6317: [
            { fileName: "lecture1.pdf", uploadedAt: "2025-04-18T10:00:00Z" },
            { fileName: "homework1.docx", uploadedAt: "2025-04-18T11:00:00Z" }
        ],
        CDA4213: [
            { fileName: "week2-notes.txt", uploadedAt: "2025-04-19T09:30:00Z" }
        ]
    };

    const [courseMaterials, setCourseMaterials] = useState({});
    const [confirmDelete, setConfirmDelete] = useState({ show: false, file: null });

    const dummyCourseInstructions = {
        CAP6317: "You are an AI assistant helping students understand AI concepts clearly and concisely.",
        CDA4213: "You are a virtual TA for computer architecture. Focus on clarity and technical depth."
      };
      
    const [courseInstructions, setCourseInstructions] = useState(dummyCourseInstructions);
    const [editedInstructions, setEditedInstructions] = useState(""); // stores textarea input

    const dummyInsightData = [
        {
            id: "CAP6317", 
            theme_summary: "Week 6 Content Inquiry",
            count: 1,
            examples: [
            "What are we covering on week 6?"
            ]
        },
        {
            id: "CAP6317",
            theme_summary: "Professor Contact Information",
            count: 2,
            examples: [
            "How can I contact the professor?",
            "What's the prof's contact info?"
            ]
        },
        {
            id: "CAP6317",
            theme_summary: "Assignment 1 Preparation",
            count: 1,
            examples: [
            "What should I read before doing assignment 1?"
            ]
        },
        {
            id: "CDA4213",
            theme_summary: "Memory Hierarchy",
            count: 3,
            examples: [
            "What is cache memory?",
            "L1 vs L2 cache?",
            "Explain virtual memory."
            ]
        },
        {
            id: "CDA4213",
            theme_summary: "Pipeline Stages",
            count: 2,
            examples: [
            "How many stages are in MIPS pipeline?",
            "Explain branch prediction."
            ]
        }
    ];
    
    const [insightData, setInsightData] = useState(dummyInsightData);
    const [insightView, setInsightView] = useState("list");
    const [selectedThemeExamples, setSelectedThemeExamples] = useState(null);

      
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



    useEffect(() => {
        // Load all flags for the selected course into central state
        const mandatory = dummyFlaggedData.mandatory.filter(f => f.course_id === selectedCourse);
        const voluntary = dummyFlaggedData.voluntary.filter(f => f.course_id === selectedCourse);
        setFlaggedData({ mandatory, voluntary });
    }, [selectedCourse]);
    
    useEffect(() => {
        if (selectedCourse) {
            setCourseMaterials(dummyCourseMaterials[selectedCourse] || []);
        }
    }, [selectedCourse]);

    useEffect(() => {
        if (selectedCourse) {
            const filteredInsights = dummyInsightData.filter(item => item.id === selectedCourse);
            setInsightData(filteredInsights);
        }
    }, [selectedCourse]);
    

    useEffect(() => {
        if (modalType === "AI Settings" && selectedCourse) {
          setEditedInstructions(courseInstructions[selectedCourse] || "");
        }
    }, [modalType, selectedCourse, courseInstructions]);


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
                    <button className="prof-nav-item" onClick={() => openModal("Student Activity")}>👥 Student Activity</button>
                    <button className="prof-nav-item" onClick={() => openModal("Course Material")}>📝 Course Material</button>
                    <button className="prof-nav-item" onClick={() => openModal("AI Settings")}>⚙️ AI Settings</button>
                    <button className="prof-nav-item" onClick={() => openModal("Notifications")}>🔔 Notifications</button>
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
                        value={selectedCourse}
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
            {/* Render modals conditionally based on modalType */}

            {/* Student Activity Modal */}
            {modalType === "Student Activity" && (
                <Modal title="Student Activity" isOpen={!!modalType} onClose={closeModal}>
                    {/* Button to toggle between list and Graph view */}
                    <div style={{ marginBottom: "20px", display: "flex", justifyContent: "center" }}>
                        <button
                            className="prof-button prof-save-button"
                            onClick={() => setInsightView(prev => prev === "list" ? "graph" : "list")}
                        >
                            Switch to {insightView === "list" ? "Graph" : "List"} View
                        </button>
                    </div>

                    {insightView === "list" ? (
                        <>
                            {/* List View */}
                            {insightData.map((item, index) => (
                            <div key={index} style={{ padding: "8px", borderBottom: "1px solid #ddd" }}>
                                <p><strong>Theme:</strong> {item.theme_summary}</p>
                                <p><strong>Count:</strong> {item.count}</p>
                                <button
                                    className="prof-button prof-reply-button"
                                    onClick={() => setSelectedThemeExamples(item)}
                                >
                                    See Questions
                                </button>
                          </div>
                            ))}
                        </>
                        ) : (
                        <>
                            {/* Graph View */}
                            <div className="insight-graph-container">
                                {insightData.map((item, idx) => (
                                    <div key={idx} className="insight-item">
                                        <div
                                            className="insight-bar"
                                            style={{ height: `${item.count * 40}px` }}
                                            title={`${item.theme_summary}: ${item.count}`}
                                        />
                                        <div className="insight-label">
                                            {item.theme_summary}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* See Questions Modal */}
                    {selectedThemeExamples && (
                        <Modal
                            title={`Questions for "${selectedThemeExamples.theme_summary}"`}
                            isOpen={true}
                            onClose={() => setSelectedThemeExamples(null)}
                        >
                            <ul style={{ paddingLeft: "30px" }}>
                                {selectedThemeExamples.examples.map((ex, idx) => (
                                    <li key={idx}>{ex}</li>
                                ))}
                            </ul>
                        </Modal>
                    )}
                </Modal>
            )}
            {modalType === "Course Material" && (
                <Modal title="Course Material" isOpen={!!modalType} onClose={closeModal}>
                {courseMaterials.length > 0 ? (
                  <ul style={{ padding: 0, listStyle: "none", marginTop: "10px" }}>
                    {courseMaterials.map((file, index) => {
                      return (
                        <li
                          key={index}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                            borderBottom: "1px solid #ccc",
                          }}
                        >
                            <span>{file.fileName}</span>
                            <button className="prof-button prof-delete-button"
                                onClick={() => setConfirmDelete({ show: true, file })}
                            >
                                Delete
                            </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p style={{ marginTop: "10px" }}>No files uploaded for this course.</p>
                )}
              </Modal>              
            )}
            {confirmDelete.show && (
                <Modal
                    title="Confirm Delete"
                    isOpen={true}
                    onClose={() => setConfirmDelete({ show: false, file: null })}
                >
                    <p>
                    Are you sure you want to delete <strong>{confirmDelete.file.fileName}</strong>?
                    </p>

                    <div className="prof-modal-footer">
                    <button
                        className="prof-button prof-delete-button"
                        onClick={() => {
                        setCourseMaterials(prev =>
                            prev.filter(f => f.fileName !== confirmDelete.file.fileName)
                        );
                        setConfirmDelete({ show: false, file: null });
                        }}
                    >
                        Yes, Delete
                    </button>

                    <button
                        className= "prof-button prof-cancel-button"
                        onClick={() => setConfirmDelete({ show: false, file: null })}
                    >
                        Cancel
                    </button>
                    </div>
                </Modal>
            )}

            {modalType === "AI Settings" && (
                <Modal title="AI Settings" isOpen={!!modalType} onClose={closeModal}>
                    <p>Customize the AI behavior for <strong>{selectedCourse}</strong>.</p>

                    <textarea
                        className="prof-ai-textarea"
                        value={editedInstructions}
                        onChange={(e) => setEditedInstructions(e.target.value)}
                    />

                    <div className="prof-modal-footer">
                    <button
                        className="prof-button prof-save-button"
                        onClick={() => {
                        setCourseInstructions(prev => ({
                            ...prev,
                            [selectedCourse]: editedInstructions
                        }));
                        alert(`Instructions updated for ${selectedCourse}`);
                        closeModal();
                        }}
                    >
                        Save Settings
                    </button>

                    <button
                        className="prof-button prof-cancel-button"
                        onClick={closeModal}
                    >
                        Cancel
                    </button>
                    </div>
                </Modal>
            )}

            {modalType === "Notifications" && (
                <Modal title="Notifications" isOpen={!!modalType} onClose={closeModal}>

                {/* Toggle to show/hide seen flags */}
                <div style={{ marginBottom: "10px" }}>
                    <label>
                        <input
                        type="checkbox"
                        checked={showSeen}
                        onChange={() => setShowSeen(prev => !prev)} // toggle the showSeen state
                        style={{ marginRight: "5px" }}
                        />
                        Show Seen Flags
                    </label>
                </div>

                {/* Mandatory flags section */}
                <h3>Mandatory Flags</h3>
                {flaggedData.mandatory
                // Only show flags from the selected course
                // If showSeen is true → show only seen flags; otherwise show only unseen
                .filter(f => f.course_id === selectedCourse && (showSeen ? f.seen : !f.seen))
                .map((flag) => (
                    <div key={flag.id} className="flag-box">
                    <p><strong>Q:</strong> {flag.question}</p>
                    <p><em>Reason:</em> {flag.reason}</p>

                    {/* Checkbox to toggle seen status for this mandatory flag */}
                    <label>
                        <input
                        type="checkbox"
                        checked={flag.seen}
                        onChange={() => {
                            // Create a new updated mandatory list with toggled seen for this flag
                            const updated = {
                            ...flaggedData,
                            mandatory: flaggedData.mandatory.map(f =>
                                f.id === flag.id ? { ...f, seen: !f.seen } : f
                            )
                            };
                            setFlaggedData(updated); // Update state with new list
                        }}
                        />
                        Mark as Seen
                    </label>
                    <hr />
                    </div>
                ))}

                {/* Voluntary flags section */}
                <h3>Voluntary Flags</h3>
                {flaggedData.voluntary
                // Show only voluntary flags from the selected course
                // Show all if showSeen is true; else show only unseen ones
                .filter(f => f.course_id === selectedCourse && (showSeen ? f.seen : !f.seen))
                .map((flag) => (
                    <div key={flag.id} className="flag-box">
                    <p><strong>Q:</strong> {flag.question}</p>
                    <p><em>Reason:</em> {flag.reason}</p>

                    {/* Checkbox to manually toggle seen status for this voluntary flag */}
                    <label>
                        <input
                        type="checkbox"
                        checked={flag.seen}
                        onChange={() => {
                            const updated = {
                            ...flaggedData,
                            voluntary: flaggedData.voluntary.map(f =>
                                f.id === flag.id ? { ...f, seen: !f.seen } : f
                            )
                            };
                            setFlaggedData(updated); // Save updated state
                        }}
                        />
                        Mark as Seen
                    </label>

                    {/* Reply box to allow the professor to respond to this flagged question */}
                    <textarea
                        rows={3}
                        style={{ width: '100%', marginTop: '10px' }}
                        placeholder="Write your reply here..."
                        value={flag.reply || ""} // controlled input
                        onChange={(e) => {
                        // Update the specific flag with new reply text
                        const updated = {
                            ...flaggedData,
                            voluntary: flaggedData.voluntary.map(f =>
                            f.id === flag.id ? { ...f, reply: e.target.value } : f
                            )
                        };
                        setFlaggedData(updated);
                        }}
                    />

                    {/* Send button to simulate a reply being sent */}
                    <button
                        className="prof-button prof-reply-button"
                        onClick={() => {
                        // Show an alert with the reply content
                        alert(`Reply sent: ${flag.reply || "[empty]"}`);

                        // Mark this specific flag as seen after the reply is "sent"
                        const updatedVoluntaryFlags = flaggedData.voluntary.map((f) => {
                            if (f.id === flag.id) {
                            return {
                                ...f,
                                reply: flag.reply || "", // keep reply content
                                seen: true               // auto-mark as seen after replying
                            };
                            }
                            return f; // don't change other flags
                        });

                        // Apply updated voluntary flags to global state
                        setFlaggedData({
                            ...flaggedData,
                            voluntary: updatedVoluntaryFlags
                        });
                        }}
                    >
                        Send Reply
                    </button>
                    <hr />
                    </div>
                ))}
            </Modal>
            )}
        </div>
    );
}

export default ProfessorDashboard;
