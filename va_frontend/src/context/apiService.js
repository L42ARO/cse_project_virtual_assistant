import { useServer } from './serverContext';

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
    return await fetchAPI('/simple-http');
  };

  // Trigger delayed response (handled via WebSocket)
  const fetchDelayedHttpMessage = async () => {
    return await fetchAPI('/delayed-http');
  };

  // Specialized function for sending a chat message via WebSocket
  const sendChatMessage = (socket, message) => {
    if (!socket) {
      console.error("Socket is not available to send the chat message.");
      return;
    }

    // Standardized message format
    const payload = { message: message.trim() };

    // Emit the event to the server
    socket.emit('send_chat', payload);
  };

  // INCLUDE MORE API BEHAVIOUR IN THIS FILE

  return {
    fetchHttpMessage,
    fetchDelayedHttpMessage,
    sendChatMessage,
  };
};
