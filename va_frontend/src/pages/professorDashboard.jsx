import './professorDashboard.css';


function ProfessorDashboard(){
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
              <button className="upload-button">⬆️</button>
            </div>
          </div>
        </div>
      );
}
    
export default ProfessorDashboard;