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
  const {
    sccChatCont,
    sccChatStart,
    sccGetSessions,
    sccGetSessionMessages,
    sccChatHistorySearch,
  } = useAPI();

  // --- Chat UI state ---
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // --- Course selection ---
  const studentCourses = ["CAP6317", "CDA4213"];
  const [selectedCourse, setSelectedCourse] = useState(studentCourses[0]);

  // --- History & search state ---
  const [allChats, setAllChats] = useState([]);          // master list
  const [searchResults, setSearchResults] = useState(null); // null = no active search

  // --- Modal & query state ---
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchModalOpen, setSearchModalOpen] = useState(false);

  // --- Timestamps & scrolling ---
  const chatBoxRef = useRef(null);
  const [lastStandbyTimestamp, setLastStandbyTimestamp] = useState(null);
  const [lastAIMessageTimestamp, setLastAIMessageTimestamp] = useState(null);

  // --- Flagged Questions (static example data) ---
  const [flaggedQuestions] = useState([
    {
      id: 1,
      question: "Can you explain pipelining again?",
      sentToProfessor: true,
      professorReply: "Sure! Pipelining allows overlapping instruction execution.",
      course: "CDA3103",
    },
    {
      id: 2,
      question: "Why does my code get a null pointer?",
      sentToProfessor: true,
      professorReply: null,
      course: "COP3330",
    },
  ]);
  const filteredFlaggedQuestions = flaggedQuestions.filter(
    (q) => q.course === selectedCourse
  );

  // --- Modal handlers ---
  const openSearchModal = () => setSearchModalOpen(true);
  const closeSearchModal = () => setSearchModalOpen(false);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // --- Load all sessions when selectedCourse changes ---
  useEffect(() => {
    const loadChatHistory = async () => {
      const token = localStorage.getItem("token");
      try {
        const result = await sccGetSessions(token, selectedCourse);
        if (result.data) {
          const sessions = result.data.map((s) => ({
            id: s.session_id,
            course_id: s.course_id,
            timestamp: s.timestamp,
            thread_id: s.thread_id,
          }));
          setAllChats(sessions);
          // clear any previous search results
          setSearchResults(null);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    };
    loadChatHistory();
  }, [selectedCourse, sccGetSessions]);

      // --- Search effect: update searchResults (normalized) or clear if query is empty ---
    useEffect(() => {
      const doSearch = async () => {
        const q = searchQuery.trim();
        if (!q) {
          setSearchResults(null);
          return;
        }
        const token = localStorage.getItem("token");
        try {
          const result = await sccChatHistorySearch(token, q);
          if (result.data) {
            const normalized = result.data.map((s) => ({
              id: s.session_id,
              course_id: s.course_id,                  // for .filter(c => c.course_id === ...)
              course: s.course_id,                     // for ChatHistory’s {chat.course}
              timestamp: s.messages[0]?.timestamp,     // Unix seconds
              thread_id: s.thread_id
            }));
            setSearchResults(normalized);
          } else {
            setSearchResults([]);
          }
        } catch (err) {
          console.error("Failed to search chat history:", err);
          setSearchResults([]);
        }
      };

      doSearch();
    }, [searchQuery, selectedCourse, sccChatHistorySearch]);



  // --- Helper: decide which to display ---
  const displayedChats = searchResults !== null ? searchResults : allChats;

  // --- Chat message handlers & socket setup ---
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const token = localStorage.getItem("token");
    if (!hasSentInitialMessage) {
      const response = await sccChatStart(
        "user123",
        selectedCourse,
        chatInput,
        token
      );
      if (response.data?.session_id) {
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
    // auto-start / no-op on mount
    handleSendMessage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleIncomingMessage = (data, sender) => {
    if (data.failed) console.error(data.details);
    const msg = { message: data.message, sender, timestamp: data.timestamp };
    setChatMessages((prev) =>
      [...prev, msg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    );
  };

  useEffect(() => {
    if (!socket) return;

    const onAI = (d) => {
      handleIncomingMessage(d, "AI");
      setLastAIMessageTimestamp(d.timestamp);
      if (
        lastStandbyTimestamp &&
        new Date(d.timestamp) > new Date(lastStandbyTimestamp)
      ) {
        setLastStandbyTimestamp(null);
      }
    };
    const onUser = (d) => {
      handleIncomingMessage(d, "User");
      setChatInput("");
    };
    const onStandby = (d) => {
      if (
        !lastAIMessageTimestamp ||
        new Date(d.timestamp) > new Date(lastAIMessageTimestamp)
      ) {
        setLastStandbyTimestamp(d.timestamp);
      }
    };

    socket.on("ws_scc_ai_res", onAI);
    socket.on("ws_scc_user_res", onUser);
    socket.on("ws_scc_ai_stdby", onStandby);
    return () => {
      socket.off("ws_scc_ai_res", onAI);
      socket.off("ws_scc_user_res", onUser);
      socket.off("ws_scc_ai_stdby", onStandby);
    };
  }, [socket, lastAIMessageTimestamp, lastStandbyTimestamp]);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chatMessages, lastStandbyTimestamp]);

  // --- Course switch reset ---
  useEffect(() => {
    setSelectedChat(null);
    setChatMessages([]);
    setSessionId(null);
    setHasSentInitialMessage(false);
    setChatInput("");
    setLastStandbyTimestamp(null);
    setLastAIMessageTimestamp(null);
  }, [selectedCourse]);

  // --- Selecting a past chat to replay ---
  const [selectedChat, setSelectedChat] = useState(null);
  const handleSelectChat = async (chat) => {
    const token = localStorage.getItem("token");
    if (selectedChat?.id === chat.id) {
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
      if (result.data) setChatMessages(result.data);
      else console.error("Failed to fetch chat messages:", result.error);
    } catch (err) {
      console.error("Error loading chat history:", err);
    }
  };

  const handleNewChat = () => {
    if (!selectedCourse) {
      alert("Please select a course before starting a new chat.");
      return;
    }
    setSelectedChat(null);
    setChatMessages([]);
    setSessionId(null);
    setHasSentInitialMessage(false);
    setChatInput("");
    const newId = Date.now();
    const newChat = {
      id: newId,
      course_id: selectedCourse,
      timestamp: Math.floor(Date.now() / 1000), // seconds
      thread_id: null,
    };
    setAllChats((prev) => [newChat, ...prev]);
    setSessionId(newId);
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/ui/login";
  };

  const shouldShowStandby =
    lastStandbyTimestamp &&
    (!lastAIMessageTimestamp ||
      new Date(lastStandbyTimestamp) > new Date(lastAIMessageTimestamp));

  return (
    <div className="student-chat-container">
      <div className="student-left-sidebar">
        <div className="student-sidebar-content">
          <h2 className="student-sidebar-title">
            Chat History
            <button
              className="search-icon-button"
              onClick={openSearchModal}
            >
              🔍
            </button>
          </h2>

          <NewChatButton onNewChat={handleNewChat} />

          <ChatHistory
            chatSessions={displayedChats
              .filter((c) => c.course_id === selectedCourse)
              .sort((a, b) => b.timestamp - a.timestamp)}
            onSelectChat={handleSelectChat}
            selectedChat={selectedChat}
          />
        </div>

        <button
          onClick={handleLogout}
          className="student-logout-button"
        >
          ← Log out
        </button>
      </div>

      <div className="student-main-content">
        <div className="student-header">
          <h1 className="student-header-title">
            {selectedCourse} - Virtual Assistant
          </h1>
          <CourseDropdown
            courses={studentCourses}
            value={selectedCourse}
            onSelectCourse={setSelectedCourse}
          />
        </div>

        <div className="student-chat-box" ref={chatBoxRef}>
          {chatMessages.map((msg, idx) => (
            <ChatBubble
              key={idx}
              sender={msg.sender}
              message={msg.message}
            />
          ))}

          {shouldShowStandby && (
            <ChatBubble sender="AI" message="..." />
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
        <FlaggedQuestionList
          flaggedQuestions={filteredFlaggedQuestions}
        />
      </div>

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
