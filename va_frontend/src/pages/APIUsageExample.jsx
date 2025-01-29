import React, { useEffect, useState } from 'react';
import { useServer } from '../context/serverContext';
import { useAPI } from '../context/apiService';

const APIUsageExample = () => {
  const { socket } = useServer();
  const { fetchHttpMessage, fetchDelayedHttpMessage, sendChatMessage } = useAPI();

  const [httpResponse, setHttpResponse] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [delayedMessages, setDelayedMessages] = useState([]);

  // Handle Simple HTTP Request
  const handleHttpRequest = async () => {
    const response = await fetchHttpMessage();
    if (response.error) {
      console.error(response.error);
    } else {
      setHttpResponse(response.message);
    }
  };

  // Handle Delayed HTTP Request
  const handleDelayedRequest = async () => {
    const response = await fetchDelayedHttpMessage();
    if (response.error) {
      console.error(response.error);
    }
  };

  // Send Chat via WebSocket (now using the simplified function)
  const handleChatSend = () => {
    if (chatInput.trim()) {
      sendChatMessage(socket, chatInput);
      setChatInput('');
    }
  };

  // Setup WebSocket Listeners
  useEffect(() => {
    if (!socket) return;

    // Receive chat response
    const handleChatResponse = (data) => {
      setChatMessages((prev) => [...prev, data.reply]);
    };

    // Receive delayed words from server
    const handleDelayedMessage = (data) => {
      setDelayedMessages((prev) => [...prev, data.word]);
    };

    socket.on('chat_response', handleChatResponse);
    socket.on('delayed_message', handleDelayedMessage);

    return () => {
      socket.off('chat_response', handleChatResponse);
      socket.off('delayed_message', handleDelayedMessage);
    };
  }, [socket]);

  return (
    <div>
      <h2>API Usage Example</h2>

      {/* Simple HTTP Request */}
      <button onClick={handleHttpRequest}>Send HTTP Request</button>
      <p>HTTP Response: {httpResponse}</p>

      {/* WebSocket Chat */}
      <h3>WebSocket Chat</h3>
      <input
        type="text"
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={handleChatSend}>Send</button>
      <ul>
        {chatMessages.map((msg, index) => (
          <li key={index}>{msg}</li>
        ))}
      </ul>

      {/* Delayed HTTP Streaming via WebSockets */}
      <h3>Streaming HTTP Response via WebSockets</h3>
      <button onClick={handleDelayedRequest}>Trigger Delayed Response</button>
      <p>{delayedMessages.join(' ')}</p>
    </div>
  );
};

export default APIUsageExample;
