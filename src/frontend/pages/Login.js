import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './login.css';
import logo from '../../asset/logo.jpeg';

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");     // ✅ error state
  const [loading, setLoading] = useState(false); // ✅ loading state

const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const res = await fetch("http://localhost:5001/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Login failed");
      setLoading(false);
      return;
    }

    // ✅ Store clean data
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("role", data.role);
    localStorage.setItem("userId", data.userId);

    // (optional)
    localStorage.setItem("user", JSON.stringify(data));

    // ✅ Navigate based on role
    if (data.role === "admin") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }

  } catch (err) {
    console.error(err);
    setError("Server error. Please try again.");
  }

  setLoading(false);
};

  return (
    <div className="fz-login-root">
      <div className="fz-card">

        {/* LEFT PANEL */}
        <div className="fz-left">
          <div className="fz-logo-area">
            <div className="fz-logo-img">
              <img src={logo} alt="FreshyZo" />
            </div>
            <span className="fz-logo-name">FreshyZo</span>
          </div>

          <div className="fz-left-body">
            <p className="fz-sub">
               Established Connection  with your FreshyZo_Connect account.
            </p>
          </div>

          <div className="fz-dots">
            <div className="fz-dot active" />
            <div className="fz-dot" />
            <div className="fz-dot" />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="fz-right">
          <h1 className="fz-welcome">Welcome 👋</h1>
          <p className="fz-subtitle">Sign in to your account</p>

          <form onSubmit={handleSubmit}>

            {/* ✅ ERROR BOX */}
            {error && (
              <div className="fz-error">
                {error}
                <span onClick={() => setError("")} className="fz-error-close">✖</span>
              </div>
            )}

            {/* EMAIL */}
            <div className="fz-field">
              <label className="fz-label">Email</label>
              <input
                className="fz-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* PASSWORD */}
            <div className="fz-field">
              <label className="fz-label">Password</label>
              <div className="fz-input-wrap">
                <input
                  className="fz-input fz-input--password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="fz-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ?"Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* BUTTON */}
            <button type="submit" className="fz-btn" disabled={loading}>
              {loading ? "Logging in..." : "Log In"}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
};

export default Login;