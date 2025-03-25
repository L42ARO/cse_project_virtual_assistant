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

  // Handle Sign In button click
  const handleSubmit = async () => {
    if (!username || !password) {
      setResponseMessage("Both username and password are required.");
      return;
    }

    try {
      const response = await loginUser(username, password);  // Use the loginUser method
      if (response.message === "student") {
        navigate('/ui/chat');  // Navigate to student chat
      }
      if (response.message === "professor") {
        navigate('/ui/professor-dashboard');  // Navigate to professor dashboard
      }
      if (response.error) {
        setResponseMessage(response.error);  // If there's an error from the backend
      } else {
        console.log("Login successful", response.message);  // Handle success
        setResponseMessage(response.message);  // Set the response message for success
      }
    } catch (error) {
      setResponseMessage("Error occurred while logging in.");  // Set error message in case of an exception
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
