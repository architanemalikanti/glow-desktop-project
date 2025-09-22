import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Search, User, Sparkles } from 'lucide-react';
import './Navbar.css';

const Navbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <Sparkles className="logo-icon" />
          <span className="logo-text">Glow</span>
        </Link>
        
        <div className="nav-links">
          <Link 
            to="/chat" 
            className={`nav-link ${isActive('/chat') ? 'active' : ''}`}
          >
            <MessageCircle size={20} />
            <span>Chat</span>
          </Link>
          
          <Link 
            to="/search" 
            className={`nav-link ${isActive('/search') ? 'active' : ''}`}
          >
            <Search size={20} />
            <span>People</span>
          </Link>
          
          <Link 
            to="/profile/me" 
            className={`nav-link ${location.pathname.includes('/profile') ? 'active' : ''}`}
          >
            <User size={20} />
            <span>Profile</span>
          </Link>
        </div>
      </div>
      

    </nav>
  );
};

export default Navbar;
