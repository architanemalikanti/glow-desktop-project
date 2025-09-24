import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import LandingPage from './components/LandingPage';
import Navbar from './components/Navbar';
import NewChatInterface from './components/NewChatInterface';
import ExplorePage from './components/ExplorePage';
import ProfilePage from './components/ProfilePage';
import PeopleSearch from './components/PeopleSearch';
import CustomCursor from './components/CustomCursor';
import './App.css';


const clientId = "1043208280305-md00aa5prr05k37a2fmdkvlfdvek38o2.apps.googleusercontent.com"


function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Global sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Global sidebar collapse state

  // Check for existing session on app load
  useEffect(() => {
    const savedUser = localStorage.getItem('glow_current_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('glow_current_user');
      }
    }
    setAuthLoading(false);
  }, []);

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('glow_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('glow_current_user');
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="App" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #ff9a56 0%, #ff6b9d 25%, #c471ed 50%, #12c2e9 75%, #c471ed 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '1.2rem' }}>Loading...</div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <GoogleOAuthProvider clientId={clientId}>
        <div className="App">
          <CustomCursor />
          <LandingPage onLogin={handleLogin} />
        </div>
      </GoogleOAuthProvider>
    );
  }

  // Show main app if authenticated
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <Router>
        <div className="App">
          <CustomCursor />
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={
              <NewChatInterface 
                currentUser={currentUser} 
                onLogout={handleLogout}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
              />
            } />
            <Route path="/chat/:conversationId" element={
              <NewChatInterface 
                currentUser={currentUser} 
                onLogout={handleLogout}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
              />
            } />
            <Route path="/explore" element={<ExplorePage currentUser={currentUser} />} />
            <Route path="/profile/:username" element={
              <ProfilePage 
                currentUser={currentUser} 
                onLogout={handleLogout}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
              />
            } />
            <Route path="/search" element={
              <>
                <Navbar />
                <main className="main-content">
                  <PeopleSearch />
                </main>
              </>
            } />
          </Routes>
        </div>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
