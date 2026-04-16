import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './frontend/pages/Login';
import Dashboard from './frontend/pages/Dashboard';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
