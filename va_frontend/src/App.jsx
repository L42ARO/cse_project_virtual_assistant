import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SideNav from './components/SideNav';
import LoginForm from './pages/loginForm.jsx';
import ProfessorDashboard from './pages/professorDashboard.jsx';
import ProfessorFiles from './pages/professorFiles.jsx';
import ProfessorChatTesting from './pages/professorChatTesting.jsx';
import StudentChat from './pages/studentChat.jsx';
import APIUsageExample from './pages/APIUsageExample.jsx';
import { ServerProvider } from './context/serverContext.jsx';
import Unauthorized from "./pages/Unauthorized.jsx";
import ProtectedRoute from "./components/ProtectedRoute";  // Import ProtectedRoute
import './App.css';

// Centralized Routes List
const routesList = [
  { url: "/ui/login", comp: <LoginForm /> },
  { url: "/ui/chat", comp: <StudentChat />, alias: "Student Chat", role: "student" },
  { url: "/ui/professor-dashboard", comp: <ProfessorDashboard />, alias: "Professor Dashboard", role: "professor" },
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
              <Route path="/ui/login" element={<LoginForm />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
                <Route path="/ui/chat" element={<StudentChat />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["professor"]} />}>
                <Route path="/ui/professor-dashboard" element={<ProfessorDashboard />} />
                <Route path="/ui/professor-files" element={<ProfessorFiles />} />
                <Route path="/ui/chat-testing" element={<ProfessorChatTesting />} />
              </Route>

              {/* Public Routes */}
              <Route path="/ui/api-example" element={<APIUsageExample />} />

            </Routes>
          </div>
        </div>
      </Router>
    </ServerProvider>
  );
}

export default App;
