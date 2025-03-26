import React, { useState } from "react";
import { useNavigate } from "react-router-dom";  // Import useNavigate
import { useAPI } from "../context/apiService";
import './LoginPage.css';

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [responseMessage, setResponseMessage] = useState("");  // New state to hold the response message
  const { loginUser } = useAPI();  // Use the loginUser function from API service
  const navigate = useNavigate();  // Initialize navigate

const handleSubmit = async () => {
  if (!username || !password) {
    setResponseMessage("Both username and password are required.");
    return;
  }

  try {
    const response = await loginUser(username, password);  // Call backend login API

    if (response.token) {
      localStorage.setItem("token", response.token);  // Store token
      localStorage.setItem("role", response.role);  // Store role

      if (response.role === "student") {
        navigate('/ui/chat');  // Navigate to student chat
      } else if (response.role === "professor") {
        navigate('/ui/professor-dashboard');  // Navigate to professor dashboard
      }
    } else {
      setResponseMessage(response.error || "Invalid login credentials.");
    }
  } catch (error) {
    setResponseMessage("Error occurred while logging in.");
    console.error("Login error", error);
  }
};

  return (
    <div className="login-container">
      {/* Left Panel - Sign In */}
      <div className="left-panel">
        <h1>Sign In</h1>
        <label>Username</label>
        <input
          type="text"
          placeholder="Username"
          className="input-box"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <label>Password</label>
        <input
          type="password"
          placeholder="Password"
          className="input-box"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* Sign in button triggers login */}
        <button className="sign-in-button" onClick={handleSubmit}>
          Sign in
        </button>

        {/* Displaying response message (success or error) */}
        {responseMessage && <p>{responseMessage}</p>}
      </div>
    </div>
  );
}

export default LoginForm;
