import './studentChat.css';

function StudentChat(){
    return (
        <div className="chat-container">
        {/* Sidebar - Chat History */}
        <div className="sidebar">
            <h2 className="sidebar-title">Chat History</h2>
            <button className="logout-button">← Log out</button>
        </div>

        {/* Main Chat Section */}
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
            <input type="text" className="chat-input" placeholder="Enter Question" />
        </div>

        {/* Sidebar - Flagged Questions */}
        <div className="right-sidebar">
            <h2 className="sidebar-title">Flagged Questions</h2>
        </div>
        </div>
    );
}
export default StudentChat;