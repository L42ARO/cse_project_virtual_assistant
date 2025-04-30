// File: ProfessorDashboard.jsx
import React, { useEffect, useState, useRef, useCallback } from "react"; // Added useCallback
import { useServer } from "../context/serverContext";
import { useAPI } from "../context/apiService";
import "./professorDashboard.css";
import CourseDropdown from "../components/CourseDropdown";
import ChatBubble from "../components/ChatBubble";
import Modal from "../components/Modal";

function ProfessorDashboard() {
    const { socket } = useServer();
    // Destructure ALL needed API functions, including new ones
    const {
        createNewCourse,
        pccChatCont,
        pccChatStart,
        pccChatIntro,
        getCourseMaterials,   // Added
        deleteCourseMaterial, // Added
        getAiSettings,        // Added
        updateAiSettings,     // Added
        uploadFile            // Ensure uploadFile is available if needed directly
     } = useAPI();

    // --- Component States ---
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [sessionId, setSessionId] = useState(null);
    const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
    const [courseId, setCourseId] = useState(null); // This seems like a placeholder, selectedCourse is used mainly
    const [professorCourses, setProfessorCourses] = useState(["CAP6317", "CDA4213"]); // Consider fetching this list too
    const [selectedCourse, setSelectedCourse] = useState(professorCourses[0]);
    const [lastStandbyTimestamp, setLastStandbyTimestamp] = useState(null);
    const [lastAIMessageTimestamp, setLastAIMessageTimestamp] = useState(null);
    const [modalType, setModalType] = useState(null);
    const [flaggedData, setFlaggedData] = useState({ mandatory: [], voluntary: [] }); // Initialize empty, connect to API later
    const [showSeen, setShowSeen] = useState(false); // For Notifications modal
    const [courseMaterials, setCourseMaterials] = useState([]); // Initialize empty array for API data
    const [confirmDelete, setConfirmDelete] = useState({ show: false, file: null });
    // Remove dummy courseInstructions state -> const [courseInstructions, setCourseInstructions] = useState(dummyCourseInstructions);
    const [editedInstructions, setEditedInstructions] = useState(""); // stores textarea input for AI settings
    const [insightData, setInsightData] = useState([]); // Initialize empty for API data
    const [insightView, setInsightView] = useState("list"); // For Student Activity modal
    const [selectedThemeExamples, setSelectedThemeExamples] = useState(null); // For Student Activity modal
    const [isLoadingMaterials, setIsLoadingMaterials] = useState(false); // Loading state
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);  // Loading state
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);  // Loading state for insights
    const [isLoadingFlags, setIsLoadingFlags] = useState(false);      // Loading state for flags

    // --- Refs ---
    const fileInputRef = useRef(null);
    const chatBoxRef = useRef(null);

    // --- Helper Functions ---
    const openModal = (type) => { setModalType(type) };
    const closeModal = () => { setModalType(null) };
    const shouldShowStandby = lastStandbyTimestamp &&
        (!lastAIMessageTimestamp || new Date(lastStandbyTimestamp) > new Date(lastAIMessageTimestamp));


    // --- File Upload ---
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file || !selectedCourse) return;

        const fileMessage = {
            message: `Uploading: ${file.name}`,
            sender: "System", // Indicate system action
            timestamp: new Date().toISOString(),
            type: "file"
        };
        setChatMessages((prev) => [...prev, fileMessage]);

        // Use the uploadFile function from apiService.js
        uploadFileToServer(file, selectedCourse, file.name);
    };

    // Use the API service function for uploads
    const uploadFileToServer = async (file, courseId, fileName) => {
        // Assuming `uploadFile` from `useAPI` handles FormData and token
        const response = await uploadFile(file, courseId); // Pass file object and courseId

        if (response?.data?.file_id) {
            console.log("File uploaded successfully via API service:", response.data.file_id);
            // Optionally add a success message to chat
            const successMessage = {
                message: `✅ Uploaded ${fileName}`,
                sender: "System",
                timestamp: new Date().toISOString(),
            };
             setChatMessages((prev) => [...prev.filter(m => m.message !== `Uploading: ${fileName}`), successMessage]); // Replace uploading message
             // Refresh course materials list after successful upload
             await fetchMaterials();
        } else {
            console.error("File upload failed via API service:", response?.error);
            // Optionally add an error message to chat
            const errorMessage = {
                message: `❌ Failed to upload ${fileName}: ${response?.error || 'Unknown error'}`,
                sender: "System",
                timestamp: new Date().toISOString(),
            };
            setChatMessages((prev) => [...prev.filter(m => m.message !== `Uploading: ${fileName}`), errorMessage]); // Replace uploading message
        }
         // Clear the file input
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };


    // --- Chat Logic ---
    const handleSendMessage = async () => {
        if (!chatInput.trim() || !selectedCourse) return;
        const token = localStorage.getItem("token");
        if (!token) {
            console.error("No token found");
            // Redirect to login or show error
            return;
        }

        if (!hasSentInitialMessage) {
            // Use pccChatStart from API service
            const response = await pccChatStart(token, selectedCourse, chatInput); // Pass token as first arg if needed by backend

            if (response?.data?.session_id) {
                setSessionId(response.data.session_id);
                setHasSentInitialMessage(true);
                // User message is echoed via WebSocket from backend in this flow
            } else {
                console.error("Failed to start chat:", response?.error);
                // Show error to user?
                return;
            }
        } else {
            if (!sessionId) {
                console.error("No session ID set. Cannot continue chat.");
                return;
            }
            // Use pccChatCont from API service (sends via WebSocket)
            pccChatCont(socket, sessionId, chatInput, token);
            // User message is echoed via WebSocket from backend
        }
        setChatInput(""); // Clear input after sending attempt
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) { // Allow Shift+Enter for new lines if needed
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
            // Avoid adding duplicate messages if backend echoes user message
            // This basic check might need refinement based on backend behavior
            if(sender === "Professor" && prev.some(m => m.message === data.message && m.timestamp === data.timestamp)) {
                return prev;
            }
            const updatedMessages = [...prev, newMessage];
            return updatedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });
    };

    // --- WebSocket Effects ---
    useEffect(() => {
        if (!socket) return;

        const handleAIResponse = (data) => {
            handleIncomingMessage(data, "AI");
            setLastAIMessageTimestamp(data.timestamp);
            if (lastStandbyTimestamp && new Date(data.timestamp) > new Date(lastStandbyTimestamp)) {
                setLastStandbyTimestamp(null); // Clear standby if AI responds after
            }
        };
        const handleUserResponse = (data) => handleIncomingMessage(data, "Professor"); // Backend echoes user msg
        const handleStandby = (data) => {
            const standbyTime = new Date(data.timestamp);
            if (!lastAIMessageTimestamp || standbyTime > new Date(lastAIMessageTimestamp)) {
                setLastStandbyTimestamp(data.timestamp);
            }
        };

        socket.on("ws_pcc_ai_res", handleAIResponse);
        socket.on("ws_pcc_user_res", handleUserResponse); // Listen for echoed user messages
        socket.on("ws_pcc_ai_stdby", handleStandby);

        return () => {
            socket.off("ws_pcc_ai_res", handleAIResponse);
            socket.off("ws_pcc_user_res", handleUserResponse);
            socket.off("ws_pcc_ai_stdby", handleStandby);
        };
    }, [socket, lastAIMessageTimestamp, lastStandbyTimestamp]); // Dependencies


    // Scroll chat box
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [chatMessages, lastStandbyTimestamp]);


    // --- Course Change Effect ---
    useEffect(() => {
        // Reset chat state
        setChatMessages([]);
        setHasSentInitialMessage(false);
        setChatInput("");
        setSessionId(null);
        setLastStandbyTimestamp(null);
        setLastAIMessageTimestamp(null);

        // Fetch Intro message if course selected
        if (selectedCourse && selectedCourse !== "Select a Course") {
            const token = localStorage.getItem("token");
            if (!token) {
                console.error("No token found in localStorage for chat intro");
                return;
            }
            // Use pccChatIntro from API service
            pccChatIntro(selectedCourse, token)
                .then((res) => {
                    // Intro message is sent via WebSocket ('ws_pcc_ai_res'), no need to handle response here
                    if (!res.ok) { // Check if fetch itself failed
                        console.error("Chat intro request failed:", res.error);
                    }
                })
                .catch((err) => {
                    console.error("Error calling chat intro:", err);
                });
        }
    }, [selectedCourse, pccChatIntro]); // Add pccChatIntro dependency


    // --- Data Fetching Effects ---

    // Fetch Course Materials
    const fetchMaterials = useCallback(async () => {
        if (selectedCourse && selectedCourse !== "Select a Course") {
            setIsLoadingMaterials(true);
            setCourseMaterials([]); // Clear old materials
            const token = localStorage.getItem("token");
            const response = await getCourseMaterials(selectedCourse, token); // Pass token if needed by API
            if (response?.data) {
                setCourseMaterials(response.data);
            } else {
                console.error("Failed to fetch course materials:", response?.error);
            }
            setIsLoadingMaterials(false);
        } else {
             setCourseMaterials([]); // Clear if no course selected
        }
    }, [selectedCourse, getCourseMaterials]);

    useEffect(() => {
        fetchMaterials();
    }, [fetchMaterials]); // Depend on the memoized function


    // Fetch AI Settings when AI Settings modal opens
    useEffect(() => {
        const fetchSettings = async () => {
            if (modalType === "AI Settings" && selectedCourse) {
                setIsLoadingSettings(true);
                setEditedInstructions(""); // Clear previous
                const token = localStorage.getItem("token");
                const response = await getAiSettings(selectedCourse, token); // Pass token if needed
                if (response?.data?.instructions) {
                    setEditedInstructions(response.data.instructions);
                } else {
                    console.error("Failed to fetch AI settings:", response?.error);
                    setEditedInstructions("Could not load settings."); // Show error in textarea
                }
                setIsLoadingSettings(false);
            }
        };
        fetchSettings();
    }, [modalType, selectedCourse, getAiSettings]);


    // Fetch Student Activity Insights (Placeholder)
    useEffect(() => {
        const fetchInsights = async () => {
            if (modalType === "Student Activity" && selectedCourse) {
                setIsLoadingInsights(true);
                setInsightData([]);
                console.warn("API call for insights not implemented yet.");
                // TODO: Call API: const response = await getInsights(selectedCourse, token);
                // if(response?.data) { setInsightData(response.data); }
                setIsLoadingInsights(false);
            }
        };
        fetchInsights();
    }, [modalType, selectedCourse]); // Add getInsights when implemented


    // Fetch Notification Flags (Placeholder)
    useEffect(() => {
        const fetchFlags = async () => {
            if (modalType === "Notifications" && selectedCourse) {
                 setIsLoadingFlags(true);
                 setFlaggedData({ mandatory: [], voluntary: [] });
                 console.warn("API call for flags not implemented yet.");
                 // TODO: Call API: const response = await getFlags(selectedCourse, token);
                 // if(response?.data) { setFlaggedData(response.data); } else { setFlaggedData({ mandatory: [], voluntary: [] }) }
                 setIsLoadingFlags(false);
            }
        };
        fetchFlags();
    }, [modalType, selectedCourse]); // Add getFlags when implemented


    // --- Action Handlers ---

     // Handle Deleting Course Material
    const handleDeleteMaterial = async () => {
          if (!confirmDelete.file || !selectedCourse) return;

          const { fileId, fileName } = confirmDelete.file;
          setIsLoadingMaterials(true);

          try {
            // don’t pass token here—your fetchAPI helper already grabs it from localStorage
            const { ok, message, error } = await deleteCourseMaterial(selectedCourse, fileId);

            if (ok) {
              alert(message || `${fileName} deleted successfully.`);
              await fetchMaterials();        // refresh the list
            } else {
              console.error("Failed to delete file:", error);
              alert(`Failed to delete ${fileName}: ${error || "Unknown error"}`);
            }
          } catch (e) {
            console.error("Unexpected error during delete:", e);
            alert(`Failed to delete ${fileName}: ${e.message}`);
          } finally {
            setIsLoadingMaterials(false);
            setConfirmDelete({ show: false, file: null });
          }
    };



    // Handle Saving AI Settings
    const handleSaveSettings = async () => {
         if (!selectedCourse) return;
        const token = localStorage.getItem("token");
        setIsLoadingSettings(true); // Indicate saving state
        const response = await updateAiSettings(selectedCourse, editedInstructions, token); // Pass token

        if (response?.data) { // Assuming backend confirms success
            alert(`Instructions updated successfully for ${selectedCourse}`);
            closeModal();
        } else {
             console.error("Failed to update AI settings:", response?.error);
            alert(`Failed to update instructions: ${response?.error || 'Unknown error'}`);
        }
        setIsLoadingSettings(false); // Turn off loading state
    };


    // Handle creating a new course (Placeholder for API call)
    const handleNewCourseClick = () => {
        const name = prompt("Enter Course Name (e.g., CDA3103):");
        if (!name || !name.trim()) return;

        // TODO: Replace with API call to create course on backend
        console.warn("API call for creating new course not implemented yet.");
        // Example: const response = await createNewCourse(name, token);
        // if (response?.data?.course_id) {
        //    setProfessorCourses(prev => [...prev, name]); // Add to local list on success
        //    setSelectedCourse(name); // Switch to the new course
        //    alert(`Course ${name} created successfully!`); 
        //} else { alert(`Failed to create course: ${response?.error}`); }

        // --- Temporary optimistic update ---
        setProfessorCourses(prev => [...prev, name]);
        setSelectedCourse(name);
        // Reset chat state (handled by useEffect on selectedCourse change)
        // --- End temporary update ---
    };

    // Handle Logout
    const handleLogout = () => {
        localStorage.removeItem("token"); // Clear token
        localStorage.removeItem("userRole"); // Clear role if stored
        window.location.href = "/ui/login"; // Redirect
    };

    // --- JSX Rendering ---
    return (
        <div className="prof-dashboard-container">
            {/* Sidebar */}
            <div className="prof-sidebar">
                <h2 className="prof-sidebar-title">Dashboard</h2>
                <nav className="prof-nav-menu">
                    {/* Updated buttons */}
                    <button className="prof-nav-item" onClick={() => openModal("Student Activity")}>📊 Student Activity</button> {/* Changed icon */}
                    <button className="prof-nav-item" onClick={() => openModal("Course Material")}>📚 Course Material</button> {/* Changed icon */}
                    <button className="prof-nav-item" onClick={() => openModal("AI Settings")}>⚙️ AI Settings</button>
                    <button className="prof-nav-item" onClick={() => openModal("Notifications")}>🔔 Notifications</button>
                </nav>
                <button onClick={handleLogout} className="prof-logout-button">← Log out</button>
            </div>

            {/* Main Content */}
            <div className="prof-main-content">
                {/* Header */}
                <div className="prof-header">
                    <h1 className="prof-header-title">
                        {selectedCourse && selectedCourse !== "Select a Course" ? `${selectedCourse} - Virtual Assistant` : "Virtual Assistant"}
                    </h1>
                    <CourseDropdown
                        courses={professorCourses}
                        onSelectCourse={setSelectedCourse}
                        onNewCourseClick={handleNewCourseClick}
                        value={selectedCourse}
                        showNewCourseOption={true}
                    />
                </div>

                {/* Chat Box */}
                <div className="prof-chat-box" ref={chatBoxRef}>
                    {chatMessages.map((msg, index) => (
                        <ChatBubble
                            key={`${msg.timestamp}-${index}`} // Better key
                            sender={msg.sender}
                            message={msg.message}
                            type={msg.type} // Pass type if needed for styling file messages etc.
                        />
                    ))}
                    {shouldShowStandby && <ChatBubble sender="AI" message="..." />}
                </div>

                {/* Input Area */}
                <div className="prof-input-container">
                    <input
                        type="text"
                        className="prof-chat-input"
                        placeholder="Modify AI behavior or ask about the course..." // Updated placeholder
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!selectedCourse || selectedCourse === "Select a Course"} // Disable if no course selected
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                        accept=".pdf,.txt,.md,.docx,.pptx,.c,.cs,.cpp,.java,.json,.py,.rb,.tex,.css,.js,.html" // Specify accepted types based on backend
                    />
                    <button
                        className="prof-upload-button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!selectedCourse || selectedCourse === "Select a Course"} // Disable if no course selected
                        title="Upload Course Material"
                    >
                        ⬆️
                    </button>
                </div>
            </div>

            {/* --- Modals --- */}

            {/* Student Activity Modal */}
            {modalType === "Student Activity" && (
                <Modal title={`Student Activity Insights - ${selectedCourse}`} isOpen={!!modalType} onClose={closeModal}>
                    {isLoadingInsights ? (
                         <p>Loading insights...</p>
                    ) : insightData.length === 0 ? (
                         <p>No activity insights found for this course yet.</p>
                    ) : (
                        <>
                            {/* View Toggle Button */}
                            <div style={{ marginBottom: "20px", display: "flex", justifyContent: "center" }}>
                                <button
                                    className="prof-button prof-save-button"
                                    onClick={() => setInsightView(prev => prev === "list" ? "graph" : "list")}
                                >
                                    Switch to {insightView === "list" ? "Graph" : "List"} View
                                </button>
                            </div>

                            {/* Conditional View Rendering */}
                            {insightView === "list" ? (
                                <> {/* List View */}
                                    {insightData.map((item, index) => (
                                    <div key={item.id || index} style={{ padding: "8px", borderBottom: "1px solid #ddd" }}>
                                        <p><strong>Theme:</strong> {item.theme_summary}</p>
                                        <p><strong>Count:</strong> {item.count}</p>
                                        <button
                                            className="prof-button prof-reply-button"
                                            onClick={() => setSelectedThemeExamples(item)} // Show examples modal
                                        >
                                            See Questions
                                        </button>
                                  </div>
                                    ))}
                                </>
                            ) : (
                                <> {/* Graph View */}
                                    <div className="insight-graph-container">
                                        {insightData.map((item, idx) => (
                                            <div key={item.id || idx} className="insight-item">
                                                <div
                                                    className="insight-bar"
                                                    style={{ height: `${item.count * 30}px` }} // Adjusted height scaling
                                                    title={`${item.theme_summary}: ${item.count}`} // Tooltip on bar
                                                />
                                                <div className="insight-label">
                                                    {item.theme_summary} ({item.count}) {/* Label with count */}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                         </>
                     )}

                    {/* See Questions (Examples) Modal */}
                    {selectedThemeExamples && (
                        <Modal
                            title={`Example Questions for "${selectedThemeExamples.theme_summary}"`}
                            isOpen={true}
                            onClose={() => setSelectedThemeExamples(null)} // Close this specific modal
                        >
                            <ul style={{ paddingLeft: "20px", maxHeight: '300px', overflowY: 'auto' }}>
                                {selectedThemeExamples.examples.map((ex, idx) => (
                                    <li key={idx} style={{ marginBottom: '5px' }}>{ex}</li>
                                ))}
                            </ul>
                        </Modal>
                    )}
                </Modal>
            )}

            {/* Course Material Modal */}
            {modalType === "Course Material" && (
                <Modal title={`Course Material - ${selectedCourse}`} isOpen={!!modalType} onClose={closeModal}>
                {isLoadingMaterials ? (
                    <p>Loading materials...</p>
                 ) : courseMaterials.length > 0 ? (
                  <ul style={{ padding: 0, listStyle: "none", marginTop: "10px", maxHeight: '400px', overflowY: 'auto' }}>
                    {courseMaterials.map((file) => ( // file MUST have { fileId, fileName } from backend
                      <li
                        key={file.fileId} // Use unique fileId from backend
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
                              onClick={() => setConfirmDelete({ show: true, file })} // Pass the whole file object
                          >
                              Delete
                          </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ marginTop: "10px" }}>No files uploaded for this course via the assistant.</p>
                )}
                 <div style={{marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px'}}>
                     <p>You can upload new materials using the '⬆️' button next to the chat input.</p>
                 </div>
              </Modal>
            )}

            {/* Confirm Delete Modal */}
            {confirmDelete.show && (
                <Modal
                    title="Confirm Delete"
                    isOpen={true}
                    onClose={() => setConfirmDelete({ show: false, file: null })}
                >
                    <p>
                    Are you sure you want to delete <strong>{confirmDelete.file?.fileName}</strong>? This cannot be undone.
                    </p>
                    <div className="prof-modal-footer">
                    <button
                        className="prof-button prof-delete-button"
                        onClick={handleDeleteMaterial} // Call the API handler
                        disabled={isLoadingMaterials} // Disable while deleting
                    >
                        {isLoadingMaterials ? "Deleting..." : "Yes, Delete"}
                    </button>
                    <button
                        className= "prof-button prof-cancel-button"
                        onClick={() => setConfirmDelete({ show: false, file: null })}
                        disabled={isLoadingMaterials}
                    >
                        Cancel
                    </button>
                    </div>
                </Modal>
            )}

            {/* AI Settings Modal */}
            {modalType === "AI Settings" && (
                <Modal title={`AI Settings - ${selectedCourse}`} isOpen={!!modalType} onClose={closeModal}>
                     <p>Customize the base instructions for the AI assistant for this course.</p>
                    {isLoadingSettings ? (
                        <p>Loading settings...</p>
                    ) : (
                        <textarea
                            className="prof-ai-textarea" // Ensure this class provides good height/width
                            value={editedInstructions}
                            onChange={(e) => setEditedInstructions(e.target.value)}
                            placeholder="Enter base instructions for the AI assistant..."
                            rows={10} // Give it some default size
                        />
                    )}
                    <div className="prof-modal-footer">
                    <button
                        className="prof-button prof-save-button"
                        onClick={handleSaveSettings} // Call the API handler
                        disabled={isLoadingSettings} // Disable button while loading/saving
                    >
                        {isLoadingSettings ? "Saving..." : "Save Settings"}
                    </button>
                    <button
                        className="prof-button prof-cancel-button"
                        onClick={closeModal}
                         disabled={isLoadingSettings}
                    >
                        Cancel
                    </button>
                    </div>
                </Modal>
            )}

             {/* Notifications Modal */}
            {modalType === "Notifications" && (
                 <Modal title={`Notifications - ${selectedCourse}`} isOpen={!!modalType} onClose={closeModal}>
                    {isLoadingFlags ? (
                        <p>Loading notifications...</p>
                    ) : (
                         <>
                         {/* Toggle Seen/Unseen */}
                        <div style={{ marginBottom: "10px" }}>
                            <label>
                                <input
                                type="checkbox"
                                checked={showSeen}
                                onChange={() => setShowSeen(prev => !prev)}
                                style={{ marginRight: "5px" }}
                                />
                                Show Acknowledged Flags
                            </label>
                        </div>

                        {/* Mandatory Flags */}
                        <h3>Mandatory Flags</h3>
                        {flaggedData.mandatory.filter(f => showSeen ? f.seen : !f.seen).length === 0 ? (
                             <p>No {showSeen ? 'acknowledged' : 'new'} mandatory flags.</p>
                        ) : (
                            flaggedData.mandatory
                                .filter(f => showSeen ? f.seen : !f.seen) // Filter based on showSeen
                                .map((flag) => (
                                    <div key={flag.id} className="flag-box">
                                        <p><strong>Q:</strong> {flag.question}</p>
                                        <p><em>Reason:</em> {flag.reason}</p>
                                        <label>
                                            <input
                                            type="checkbox"
                                            checked={flag.seen}
                                            onChange={() => {
                                                // TODO: Call API to update flag status
                                                console.warn("API call to update flag 'seen' status not implemented.");
                                                // Optimistic update for now:
                                                const updated = {
                                                    ...flaggedData,
                                                    mandatory: flaggedData.mandatory.map(f =>
                                                        f.id === flag.id ? { ...f, seen: !f.seen } : f
                                                    )
                                                };
                                                setFlaggedData(updated);
                                            }}
                                            />
                                            Mark as {flag.seen ? 'Unseen' : 'Acknowledged'}
                                        </label>
                                        <hr />
                                    </div>
                                ))
                            )}

                        {/* Voluntary Flags */}
                        <h3>Voluntary Flags</h3>
                        {flaggedData.voluntary.filter(f => showSeen ? f.seen : !f.seen).length === 0 ? (
                            <p>No {showSeen ? 'acknowledged' : 'new'} voluntary flags.</p>
                        ) : (
                             flaggedData.voluntary
                                .filter(f => showSeen ? f.seen : !f.seen) // Filter based on showSeen
                                .map((flag) => (
                                    <div key={flag.id} className="flag-box">
                                        <p><strong>Q:</strong> {flag.question}</p>
                                        <p><em>Reason:</em> {flag.reason}</p>
                                        <label style={{ marginRight: '15px' }}>
                                            <input
                                            type="checkbox"
                                            checked={flag.seen}
                                            onChange={() => {
                                                // TODO: Call API to update flag status
                                                 console.warn("API call to update flag 'seen' status not implemented.");
                                                // Optimistic update:
                                                const updated = {
                                                ...flaggedData,
                                                voluntary: flaggedData.voluntary.map(f =>
                                                    f.id === flag.id ? { ...f, seen: !f.seen } : f
                                                )
                                                };
                                                setFlaggedData(updated);
                                            }}
                                            />
                                             Mark as {flag.seen ? 'Unseen' : 'Acknowledged'}
                                        </label>
                                        <textarea
                                            rows={2}
                                            style={{ width: '100%', marginTop: '10px', marginBottom: '5px' }}
                                            placeholder="Write an optional direct reply here..."
                                            value={flag.reply || ""}
                                            onChange={(e) => {
                                                 // Update local state only for reply input
                                                const updated = {
                                                    ...flaggedData,
                                                    voluntary: flaggedData.voluntary.map(f =>
                                                        f.id === flag.id ? { ...f, reply: e.target.value } : f
                                                    )
                                                };
                                                setFlaggedData(updated);
                                            }}
                                        />
                                        <button
                                            className="prof-button prof-reply-button"
                                            onClick={() => {
                                                 // TODO: Call API to send reply and mark as seen
                                                console.warn("API call to send reply and update flag not implemented.");
                                                alert(`Simulating reply send for "${flag.question}": ${flag.reply || "[No reply text]"}`); 
                                                // Optimistic update:
                                                 const updatedVoluntaryFlags = flaggedData.voluntary.map((f) =>
                                                    f.id === flag.id ? { ...f, seen: true } : f // Mark seen
                                                 );
                                                 setFlaggedData({ ...flaggedData, voluntary: updatedVoluntaryFlags });
                                            }}
                                        >
                                            Send Reply & Acknowledge
                                        </button>
                                        <hr />
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </Modal>
            )} {/* End Notifications Modal */}
        </div> // End prof-dashboard-container
    );
}

export default ProfessorDashboard;
