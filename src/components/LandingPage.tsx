import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import './LandingPage.css';

interface LandingPageProps {
  onLogin: (user: any) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  // Decode Google JWT token
  const decodeGoogleJWT = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  };

  // Handle Google login success
  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setLoading(true);
      setError('');

      // Decode the JWT token to get user info
      const userInfo = decodeGoogleJWT(credentialResponse.credential);
      
      if (!userInfo) {
        setError('Failed to decode Google user information');
        return;
      }

      // Send Google user info to backend
      const response = await fetch('http://localhost:5001/api/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userInfo.email,
          name: userInfo.name,
          given_name: userInfo.given_name,
          family_name: userInfo.family_name,
          picture: userInfo.picture,
          google_id: userInfo.sub
        })
      });

      const data = await response.json();

      if (data.success) {
        onLogin(data.user);
        // Navigation will be handled by App.tsx after login
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Google login error:', error);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Google login error
  const handleGoogleError = () => {
    setError('Google login was cancelled or failed. Please try again.');
  };

  return (
    <div className="landing-container">
      {/* Simple header */}
      <header className="landing-header">
        <div className="logo">
          <Sparkles className="logo-icon" />
          <span>glow</span>
        </div>
      </header>

      {/* Main content */}
      <main className="landing-main">
        <div className="hero-content">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
            <motion.h1 
              className="hero-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{ margin: 0 }}
            >
              welcome to glow.
            </motion.h1>
            <motion.span 
              style={{ 
                fontSize: 'clamp(2.5rem, 6vw, 4rem)', 
                lineHeight: 1.2,
                filter: 'none'
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              🎉
            </motion.span>
          </div>
          
          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            a new kind of chatbot, built for human connection <span style={{filter: 'none', color: 'initial'}}>🤝</span> through conversation <span style={{filter: 'none', color: 'initial'}}>💬</span>
          </motion.p>
        </div>

        {/* Google Login Section */}
        <motion.div 
          className="login-section"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="login-header">
            <h2 className="login-title">Get Started</h2>
            <p className="login-subtitle">Choose how you'd like to continue</p>
          </div>

          {/* Tab Navigation */}
          <motion.div 
            className="tab-navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <button
              className={`tab-button ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Log In
            </button>
            <button
              className={`tab-button ${activeTab === 'signup' ? 'active' : ''}`}
              onClick={() => setActiveTab('signup')}
            >
              Sign Up
            </button>
          </motion.div>

          {error && (
            <motion.div 
              className="error-message"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}

          {/* Google Login Button */}
          <motion.div 
            className="google-login-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <div className="google-login-wrapper">
              {loading ? (
                <div className="google-loading">
                  <div className="loading-spinner" />
                  <span>{activeTab === 'login' ? 'Signing you in...' : 'Creating your account...'}</span>
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap={false}
                  theme="outline"
                  size="large"
                  text={activeTab === 'login' ? 'signin_with' : 'signup_with'}
                  shape="rectangular"
                  width="320"
                />
              )}
            </div>
            
            <motion.p 
              className="google-disclaimer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              {activeTab === 'login' 
                ? "Welcome back! Sign in with your Google account." 
                : "New to Glow? Create your account with Google - no password required."
              }
            </motion.p>
          </motion.div>
        </motion.div>
      </main>

      {/* Subtle sparkles */}
      <div className="sparkles">
        {Array.from({ length: 20 }, (_, i) => (
          <motion.div
            key={i}
            className="sparkle"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5]
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "easeInOut"
            }}
            style={{
              left: `${60 + Math.random() * 35}%`,
              top: `${5 + Math.random() * 40}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default LandingPage;