import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../index.css';
import './login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorStatus, setErrorStatus] = useState({ message: '', input: '' });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleInputChange = (setter) => (e) => {
    setErrorStatus({ message: '', input: '' });
    setter(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorStatus({ message: '', input: '' });

    if (!username.trim()) {
      setErrorStatus({ message: 'Please enter your username.', input: 'username' });
      return;
    }
    if (!password) {
      setErrorStatus({ message: 'Please enter your password.', input: 'password' });
      return;
    }

    setSubmitting(true);
    
    // Convert username to internal email for Supabase
    const internalEmail = `${username.trim().toLowerCase()}@skillcloud-internal.com`;

    // 1. Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password: password,
    });

    if (authError) {
      setSubmitting(false);
      setErrorStatus({ message: 'Invalid username or password.', input: 'both' });
      return;
    }

    // 2. Fetch the user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    setSubmitting(false);

    if (userError || !userData) {
      navigate('/dashboard');
      return;
    }

    if (userData.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="login-wrapper">
      {/* ... (aside unchanged) */}
      <aside className="left-panel">
        <div className="left-content">
          <div className="logo">
            <img
              src="/logo.png"
              alt="SkillCloud Staffing"
              style={{ height: '56px', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
          </div>
          <div className="headline">
            <h1>Elevate your<br /><span className="highlight">team's</span> full<br />potential</h1>
            <p className="headline-desc">
              The corporate learning platform built to drive professional growth for every associate.
            </p>
          </div>
          <ul className="feature-list">
            <li>Role-based course assignments</li>
            <li>Real-time progress tracking</li>
            <li>Integrated assessments</li>
          </ul>
        </div>
        <p className="left-footer">© {new Date().getFullYear()} SkillCloud Staffing</p>
      </aside>

      <main className="right-panel">
        <div className="form-container">
          <div className="form-header">
            <img
              src="/logo.png"
              alt="SkillCloud Staffing"
              style={{ height: '44px', width: 'auto', objectFit: 'contain', marginBottom: '20px' }}
            />
            <h2>Sign In</h2>
            <p>Access your corporate account</p>
          </div>

          <form id="loginForm" noValidate onSubmit={handleSubmit}>
            {/* Username */}
            <div className="field-group">
              <label htmlFor="username">USERNAME</label>
              <div className={`input-wrapper ${(errorStatus.input === 'username' || errorStatus.input === 'both') ? 'error' : ''}`}>
                <span className="input-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <circle cx="12" cy="7" r="4" />
                    <path d="M5.5 21v-2a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v2" />
                  </svg>
                </span>
                <input
                  id="username"
                  type="text"
                  name="username"
                  placeholder="joshua.rodriguez"
                  autoComplete="username"
                  value={username}
                  onChange={handleInputChange(setUsername)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="field-group">
              <label htmlFor="password">PASSWORD</label>
              <div className={`input-wrapper ${(errorStatus.input === 'password' || errorStatus.input === 'both') ? 'error' : ''}`}>
                <span className="input-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={handleInputChange(setPassword)}
                />
                <button
                  type="button"
                  id="togglePassword"
                  className="eye-btn"
                  aria-label="Toggle password visibility"
                  onClick={handleTogglePassword}
                >
                  <svg id="eyeIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="form-options">
              <label className="remember-label">
                <input type="checkbox" id="remember" name="remember" />
                <span className="checkmark"></span>
                Remember me
              </label>
              <a href="#" className="forgot-link">Forgot password?</a>
            </div>

            {/* Error message */}
            <p id="errorMsg" className="error-msg" role="alert" aria-live="polite">
              {errorStatus.message}
            </p>

            {/* Submit */}
            <button type="submit" id="submitBtn" className="submit-btn" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in to your account'}
            </button>
          </form>
        </div>
        <p className="right-footer">© {new Date().getFullYear()} SkillCloud Staffing · All rights reserved</p>
      </main>
    </div>
  );
}
