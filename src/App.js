import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Login from './frontend/pages/Login';
import Dashboard from './frontend/pages/Dashboard';
import ProtectedRoute from "./frontend/components/ProtectedRoute";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>

          <Route path="/" element={<Login />} />

          {/* ✅ Protected Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

        </Routes>
      </div>
    </Router>
  );
}

export default App;