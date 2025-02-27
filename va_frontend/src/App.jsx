import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SideNav from './components/SideNav';
import LoginForm from './pages/loginForm.jsx';
import ProfessorDashboard from './pages/professorDashboard.jsx';
import ProfessorFiles from './pages/professorFiles.jsx';
import ProfessorChatTesting from './pages/professorChatTesting.jsx';
import StudentChat from './pages/studentChat.jsx';
import APIUsageExample from './pages/APIUsageExample.jsx';
import { ServerProvider } from './context/serverContext.jsx';
import './App.css';

// Centralized Routes List
const routesList = [
  { url: "/ui/login", comp: <LoginForm /> },
  { url: "/ui/chat", comp: <StudentChat />, alias: "Student Chat" },
  { url: "/ui/professor-dashboard", comp: <ProfessorDashboard />, alias: "Professor Dashboard" },
  // { url: "/ui/professor-files", comp: <ProfessorFiles />, alias: "Professor Files" },
  // { url: "/ui/chat-testing", comp: <ProfessorChatTesting />, alias: "Professor Chat Testing" },
 { url: "/ui/api-example", comp: <APIUsageExample />, alias: "API Example" },
];

function App() {
  return (
    <ServerProvider>
      <Router>
        <div className="app-container">
          <SideNav routes={routesList} loginUrl={routesList[0].url} />
          <div className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to={routesList[0].url} replace />} />
              {routesList.map(({ url, comp }) => (
                <Route key={url} path={url} element={comp} />
              ))}
            </Routes>
          </div>
        </div>
      </Router>
    </ServerProvider>
  );
}

export default App;
