import { useRef } from 'react';
import './professorDashboard.css';

function ProfessorDashboard() {
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      alert(`File "${file.name}" uploaded successfully! (Simulated)`);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <h2 className="sidebar-title">Dashboard</h2>
        <nav className="nav-menu">
          <p className="nav-item">🏠 Dashboard</p>
          <p className="nav-item">👥 Student Activity</p>
          <p className="nav-item">⚙️ AI Settings</p>
          <p className="nav-item">🔔 Notifications</p>
        </nav>
        <button className="logout-button">← Log out</button>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <div className="header">
          <h1 className="header-title">CDA3103 - Virtual Assistant</h1>
          <div className="course-dropdown">
            <span>Courses ▼</span>
          </div>
        </div>

        {/* Chat Box */}
        <div className="chat-box"></div>

        {/* Input Box */}
        <div className="input-container">
          <input type="text" className="chat-input" placeholder="Enter Question" />
          
          {/* Hidden file input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />

          {/* Upload Button */}
          <button 
            className="upload-button" 
            onClick={() => fileInputRef.current.click()}
          >
            ⬆️
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfessorDashboard;
