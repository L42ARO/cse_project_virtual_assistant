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
  const sccStartChat = async (userId, courseId, initialMessage, token) => {
    const payload = {
      user_id: userId,
      token: token,
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

  const sccContChat = (socket, session_id, message, token) => {
    const payload = {
      token: token,
      session_id: session_id,
      message: message.trim(),
    };

    if (!socket) {
      console.error("Socket is not available to send the chat message.");
      return;
    }
    // Emit the event to the server
    socket.emit("ws_scc_chat_req", payload);
  };

  const pccContChat = (socket, session_id, message, key) => {
    const payload = {
      key:key,
      message: message.trim(),
      session_id: session_id,
    };

    if (!socket) {
      console.error("Socket is not available to send the chat message.");
      return;
    }
    // Emit the event to the server
    socket.emit("ws_pcc_chat_req", payload);
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

  const fetchUsers = async () => {
    return await fetchAPI("/users/get-users");
  };

  // Function to login a user
  const loginUser = async (username, password) => {
  const payload = { username, password };

  try {
    const response = await fetchAPI("/users/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Check if the response contains an error message or not
    if (response.error) {
      throw new Error(response.error);
    }
    return response; // Return the response data from the server (success or message)
  } catch (error) {
    console.error("Login API error:", error);
    return { error: error.message };  // Handle errors here
  }
};

  return {
    fetchHttpMessage,
    fetchDelayedHttpMessage,
    sendChatMessage,
    sccStartChat, 
    sccContChat,
    pccContChat,
    createNewCourse, // New API function for creating a course
    uploadFile,// New API function for file uploads
    fetchUsers,
    loginUser
  };
};
