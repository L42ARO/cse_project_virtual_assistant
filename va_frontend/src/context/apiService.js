import { useServer } from "./serverContext";

export const useAPI = () => {
  const { serverURL } = useServer();

  // Handles HTTP requests with error handling
  const fetchAPI = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${serverURL}${endpoint}`, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("API Request Failed:", error);
      return { error: error.message };
    }
  };

  // Simple HTTP request
  const fetchHttpMessage = async () => {
    return await fetchAPI("/simple-http");
  };

  // Trigger delayed response (handled via WebSocket)
  const fetchDelayedHttpMessage = async () => {
    return await fetchAPI("/delayed-http");
  };

  // Starts a student chat session
  const startChat = async (userId, courseId, initialMessage, key) => {
    const payload = {
      user_id: userId,
      key: key,
      initial_message: initialMessage.trim(),
      course_id: courseId,
    };

    return await fetchAPI("/scc/start-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  };

  // Creates a new course (Professor API)
  const createNewCourse = async (professorId, key, initialMessage, courseName, courseSection, courseTerm) => {
    const payload = {
      professor_id: professorId,
      key: key,
      initial_message: initialMessage.trim(),
      course_name: courseName,
      course_section: courseSection,
      course_term: courseTerm,
    };

    return await fetchAPI("/pcc/new-course", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  };

  // Uploads a file for a course
  const uploadFile = async (file, courseId) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("course_id", courseId);

    try {
      const response = await fetch(`${serverURL}/pcc/upload-file`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("File Upload Failed:", error);
      return { error: error.message };
    }
  };

  // Send chat message via WebSocket
  const sendChatMessage = (socket, message) => {
    if (!socket) {
      console.error("Socket is not available to send the chat message.");
      return;
    }

    // Standardized message format
    const payload = { message: message.trim() };

    // Emit the event to the server
    socket.emit("send_chat", payload);
  };

  return {
    fetchHttpMessage,
    fetchDelayedHttpMessage,
    sendChatMessage,
    startChat, 
    createNewCourse, // New API function for creating a course
    uploadFile, // New API function for file uploads
  };
};
