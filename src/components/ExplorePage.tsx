import React, { useState, useEffect } from 'react';
import { Home, Search, User, UserPlus, UserCheck, Clock, X, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { config } from '../config';
import ChatSidebar from './ChatSidebar';
import './ExplorePage.css';

interface SearchUser {
  id: string;
  username: string;
  name: string;
  email: string;
  followers_count: number;
  following_count: number;
  relationship_status: 'none' | 'following' | 'pending_outgoing' | 'pending_incoming';
}

interface FollowRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_user: {
    id: string;
    username: string;
    name: string;
    email: string;
  };
  created_at: string;
}

interface ExplorePageProps {
  currentUser?: any;
}

const ExplorePage: React.FC<ExplorePageProps> = ({ currentUser }) => {
  const [activeNav, setActiveNav] = useState('home');
  const [activeTab, setActiveTab] = useState<'search' | 'requests'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId] = useState(currentUser?.username || 'archu'); // Use logged in user or default to archu
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // Fetch follow requests on component mount
  useEffect(() => {
    fetchFollowRequests();
  }, []);

  const fetchFollowRequests = async () => {
    try {
      const response = await fetch(`${config.API_URL}/api/follow-requests?user_id=${currentUserId}`);
      const data = await response.json();
      
      if (data.success) {
        setFollowRequests(data.follow_requests);
      }
    } catch (error) {
      console.error('Error fetching follow requests:', error);
    }
  };

  const searchUsers = async (username: string) => {
    if (!username.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${config.API_URL}/api/search-users?username=${encodeURIComponent(username)}&user_id=${currentUserId}`
      );
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.users);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendFollowRequest = async (username: string) => {
    try {
      const response = await fetch('${config.API_URL}/api/send-follow-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_user_id: currentUserId,
          to_username: username
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Update the user's status in search results
        setSearchResults(prev => prev.map(user => 
          user.username === username 
            ? { ...user, relationship_status: 'pending_outgoing' }
            : user
        ));
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error sending follow request:', error);
    }
  };

  const respondToFollowRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      const response = await fetch('${config.API_URL}/api/respond-follow-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: requestId,
          action: action,
          user_id: currentUserId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Remove the request from the list
        setFollowRequests(prev => prev.filter(req => req.id !== requestId));
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error responding to follow request:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers(searchQuery);
  };

  const navigateToProfile = (username: string) => {
    navigate(`/profile/${username}`);
  };

  // Sidebar functions
  const handleNewChat = () => {
    navigate('/chat');
  };

  const handleSelectConversation = (conversationId: string) => {
    navigate(`/chat/${conversationId}`);
  };

  return (
    <div className="explore-page">
      {/* Menu Button */}
      <button
        className={`menu-button ${sidebarOpen ? 'hidden' : ''}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: '32px',
          left: '32px',
          width: '60px',
          height: '60px',
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 -1px 0 rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          e.currentTarget.style.color = 'rgba(0, 0, 0, 1)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.color = 'rgba(0, 0, 0, 0.8)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 -1px 0 rgba(0, 0, 0, 0.1)';
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          alignItems: 'center',
        }}>
          <div style={{
            width: '16px',
            height: '2px',
            backgroundColor: 'currentColor',
            borderRadius: '1px',
          }} />
          <div style={{
            width: '16px',
            height: '2px',
            backgroundColor: 'currentColor',
            borderRadius: '1px',
          }} />
          <div style={{
            width: '16px',
            height: '2px',
            backgroundColor: 'currentColor',
            borderRadius: '1px',
          }} />
        </div>
      </button>

      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentConversationId={undefined}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        currentUser={currentUser}
        onLogout={() => {}} // No logout functionality needed here
        onUpdateConversationTitle={() => {}} // No need for title updates on explore page
      />

      {/* Navigation Header */}

      {/* Main Content */}
      <div className="portfolio-main">
        {activeNav === 'home' && (
          <motion.div 
            className="home-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="discover-content">
              <h1 className="discover-title">
                find your friends
              </h1>
                <p className="discover-subtitle">
                  explore their memories
                </p>

              {/* Cute Friends Icon */}
              <motion.div 
                className="friends-icon"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <div className="friends-container">
                  {/* Cute friends emoji-style figures */}
                  <div className="friends-figures">
                    <div className="friend-figure friend-1">
                      <div className="friend-head"></div>
                      <div className="friend-body"></div>
                    </div>
                    <div className="friend-figure friend-2">
                      <div className="friend-head"></div>
                      <div className="friend-body"></div>
                    </div>
                    <div className="friend-figure friend-3">
                      <div className="friend-head"></div>
                      <div className="friend-body"></div>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              {/* Elegant Search */}
              <motion.div 
                className="search-container"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <form onSubmit={handleSearch} className="elegant-search-form">
                  <div className="search-field">
                    <Search className="search-icon" size={20} />
                    <input
                      type="text"
                      placeholder="Search by username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                    <button type="submit" className="search-submit" disabled={loading}>
                      {loading ? (
                        <div className="loading-spinner" />
                      ) : (
                        <Search size={16} />
                      )}
                    </button>
                  </div>
                </form>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <motion.div 
                    className="search-results"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="results-grid">
                      {searchResults.map((user, index) => (
                        <motion.div
                          key={user.id}
                          className="friend-card"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.1 }}
                          onClick={() => navigateToProfile(user.username)}
                        >
                          <div className="friend-avatar">
                            <User size={32} />
                          </div>
                          <div className="friend-info">
                            <h3 className="friend-name">{user.name}</h3>
                            <p className="friend-username">@{user.username}</p>
                            <div className="friend-stats">
                              <span>{user.followers_count} followers</span>
                              <span className="separator">•</span>
                              <span>{user.following_count} following</span>
                            </div>
                          </div>
                          
                          <div className="friend-action">
                            {user.relationship_status === 'none' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendFollowRequest(user.username);
                                }}
                                className="follow-btn"
                              >
                                <UserPlus size={16} />
                                Follow
                              </button>
                            )}
                            {user.relationship_status === 'following' && (
                              <button className="following-btn">
                                <UserCheck size={16} />
                                Following
                              </button>
                            )}
                            {user.relationship_status === 'pending_outgoing' && (
                              <button className="pending-btn">
                                <Clock size={16} />
                                Pending
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Follow Requests Section */}
                {followRequests.length > 0 && (
                  <motion.div 
                    className="requests-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >
                    <h3 className="requests-title">Friend Requests</h3>
                    <div className="requests-grid">
                      {followRequests.map((request, index) => (
                        <motion.div
                          key={request.id}
                          className="request-card"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.1 }}
                        >
                          <div className="friend-avatar">
                            <User size={24} />
                          </div>
                          <div className="friend-info">
                            <h4 className="friend-name">{request.from_user.name}</h4>
                            <p className="friend-username">@{request.from_user.username}</p>
                          </div>
                          <div className="request-actions">
                            <button 
                              onClick={() => respondToFollowRequest(request.id, 'accept')}
                              className="accept-btn"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => respondToFollowRequest(request.id, 'decline')}
                              className="decline-btn"
                            >
                              Decline
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {activeNav === 'projects' && (
          <motion.div 
            className="projects-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h2 className="section-title">Projects</h2>
            <div className="projects-grid">
              <div className="project-card">
                <h3>Glow AI Assistant</h3>
                <p>A conversational AI platform with beautiful interface design and seamless user experience.</p>
              </div>
              <div className="project-card">
                <h3>Design System</h3>
                <p>Comprehensive design system with liquid glass components and modern aesthetics.</p>
              </div>
              <div className="project-card">
                <h3>Mobile Experience</h3>
                <p>Cross-platform mobile application focusing on user engagement and accessibility.</p>
              </div>
            </div>
          </motion.div>
        )}

        {activeNav === 'craft' && (
          <motion.div 
            className="craft-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h2 className="section-title">Craft</h2>
            <p className="craft-description">
              Exploring the intersection of technology and human experience through thoughtful design.
            </p>
            <div className="craft-items">
              <div className="craft-item">
                <h4>Interface Design</h4>
                <p>Creating intuitive and beautiful user interfaces that feel natural to use.</p>
              </div>
              <div className="craft-item">
                <h4>Interaction Patterns</h4>
                <p>Developing micro-interactions and animations that enhance user delight.</p>
              </div>
              <div className="craft-item">
                <h4>Design Systems</h4>
                <p>Building scalable design languages that maintain consistency across products.</p>
              </div>
            </div>
          </motion.div>
        )}

        {activeNav === 'connect' && (
          <motion.div 
            className="connect-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h2 className="section-title">Connect</h2>
            <p className="connect-description">
              Let's collaborate and create something amazing together.
            </p>
            <div className="connect-options">
              <button className="connect-btn">
                <span>Email</span>
              </button>
              <button className="connect-btn">
                <span>LinkedIn</span>
              </button>
              <button className="connect-btn">
                <span>Twitter</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ExplorePage;
