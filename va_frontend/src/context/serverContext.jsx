// ServerContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const ServerContext = createContext({
  serverURL: '',
  socket: null,
  connect: () => {},
  disconnect: () => {},
});

export const ServerProvider = ({ children }) => {
  const isLocalhost = window.location.hostname === 'localhost';
  const serverURL = isLocalhost ? 'http://127.0.0.1:8000' : window.location.origin;

  const [socket, setSocket] = useState(null);
  const connectionRef = useRef(false);

  const connect = useCallback(() => {
    if (connectionRef.current || socket) return;

    connectionRef.current = true;
    const newSocket = io(serverURL);

    newSocket.on('connect', () => {
      console.log("WebSocket connected");
    });

    newSocket.on('disconnect', () => {
      console.log("WebSocket closed, attempting reconnect...");
      setTimeout(() => connect(), 5000);
    });

    newSocket.on('error', (err) => {
      console.log("WebSocket error", err);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      connectionRef.current = false;
    };
  }, [serverURL, socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      connectionRef.current = false;
    }
  }, [socket]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <ServerContext.Provider value={{ serverURL, connect, disconnect, socket}}>
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => useContext(ServerContext);
