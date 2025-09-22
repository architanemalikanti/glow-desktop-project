import React, { useState, useEffect } from 'react';
import { Plus, Search, User, X, MessageSquare, LogOut, Heart, ArrowLeft, UserCheck, UserX, MoreHorizontal, Trash2, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config';
import './ChatSidebar.css';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  currentUser?: any;
  onLogout: () => void;
  onUpdateConversationTitle?: (updateFunction: (conversationId: string, newTitle: string) => void) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  onToggle,
  currentConversationId,
  onSelectConversation,
  onNewChat,
  currentUser,
  onLogout,
  onUpdateConversationTitle
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearchChats, setShowSearchChats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'chats' | 'notifications'>('chats');
  const [followRequests, setFollowRequests] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [renamingConversation, setRenamingConversation] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchConversations();
  }, [currentUser]); // Re-fetch when currentUser changes

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveDropdown(null);
    };

    if (activeDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeDropdown]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const userId = currentUser?.username || 'archu'; // Use actual logged-in user
      const response = await fetch(`${config.API_URL}/api/conversations?user_id=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to update conversation title in real-time
  const updateConversationTitle = (conversationId: string, newTitle: string) => {
    console.log(`🔄 Updating conversation ${conversationId} title to: ${newTitle}`);
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId ? { ...conv, title: newTitle } : conv
    ));
  };

  // Pass the update function to parent on mount
  useEffect(() => {
    if (onUpdateConversationTitle) {
      onUpdateConversationTitle(updateConversationTitle);
    }
  }, [onUpdateConversationTitle]);

  const handleNewChat = () => {
    navigate('/chat');
    onNewChat();
    setShowSearchChats(false);
    // Don't close sidebar - keep it open
  };

  const handleSearchChats = () => {
    setShowSearchChats(!showSearchChats);
  };

  const handleProfileClick = () => {
    if (currentUser?.username) {
      navigate(`/profile/${currentUser.username}`);
      // Don't close sidebar - keep it open
    }
  };

  const fetchFollowRequests = async () => {
    if (!currentUser?.username) return;
    
    setNotificationsLoading(true);
    try {
      const response = await fetch(`http://localhost:5001/api/follow-requests?user_id=${currentUser.username}`);
      if (response.ok) {
        const data = await response.json();
        setFollowRequests(data.follow_requests || []);
      }
    } catch (error) {
      console.error('Error fetching follow requests:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleNotifications = () => {
    setViewMode('notifications');
    setShowSearchChats(false);
    fetchFollowRequests();
  };

  const handleBackToChats = () => {
    setViewMode('chats');
  };

  const respondToFollowRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      const response = await fetch('http://localhost:5001/api/respond-follow-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: requestId,
          action,
          user_id: currentUser?.username
        }),
      });

      if (response.ok) {
        // Remove the request from the list
        setFollowRequests(prev => prev.filter(req => req.id !== requestId));
      } else {
        console.error('Error responding to follow request');
      }
    } catch (error) {
      console.error('Error responding to follow request:', error);
    }
  };

  const handleLogout = () => {
    // Clear any stored authentication data
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    
    // Call the parent logout function if provided
    if (onLogout) {
      onLogout();
    }
    
    // Redirect to login or landing page
    navigate('/');
    
    // Optionally reload the page to ensure clean state
    window.location.reload();
  };

  const handleDropdownToggle = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent conversation selection
    setActiveDropdown(activeDropdown === conversationId ? null : conversationId);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`http://localhost:5001/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove conversation from local state
        setConversations(prev => prev.filter(conv => conv.id !== conversationId));
        setActiveDropdown(null);
        
        // If we're currently viewing the deleted conversation, navigate to home
        if (currentConversationId === conversationId) {
          onNewChat(); // This should clear the current conversation
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to delete conversation:', errorData);
        alert(`Failed to delete conversation: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Error deleting conversation. Please try again.');
    }
  };

  const handleRenameStart = (conversationId: string, currentTitle: string) => {
    setRenamingConversation(conversationId);
    setNewTitle(currentTitle);
    setActiveDropdown(null);
  };

  const handleRenameSubmit = async (conversationId: string) => {
    if (!newTitle.trim()) return;

    try {
      const response = await fetch(`http://localhost:5001/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTitle.trim()
        }),
      });

      if (response.ok) {
        // Update conversation title in local state
        setConversations(prev => prev.map(conv => 
          conv.id === conversationId ? { ...conv, title: newTitle.trim() } : conv
        ));
        setRenamingConversation(null);
        setNewTitle('');
      } else {
        const errorData = await response.json();
        console.error('Failed to rename conversation:', errorData);
        alert(`Failed to rename conversation: ${errorData.error || 'Unknown error'}`);
        // Keep the rename UI open for user to try again
      }
    } catch (error) {
      console.error('Error renaming conversation:', error);
      alert('Error renaming conversation. Please try again.');
      // Keep the rename UI open for user to try again
    }
  };

  const handleRenameCancel = () => {
    setRenamingConversation(null);
    setNewTitle('');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      });
    }
  };

  const groupConversationsByDate = (conversations: Conversation[]) => {
    const groups: { [key: string]: Conversation[] } = {};
    
    conversations.forEach(conv => {
      const dateKey = formatDate(conv.updated_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(conv);
    });

    return groups;
  };

  const conversationGroups = groupConversationsByDate(conversations);

  return (
    <>
      {/* Sidebar - Claude style layout with collapse */}
       <div
        className={`chat-sidebar ${isOpen ? 'open' : ''}`}
      >
        <div className="sidebar-content">
          {/* Header with Glow title and close button */}
          <div className="sidebar-header">
            <div className="header-content">
              {viewMode === 'notifications' ? (
                <div className="notifications-header-content">
                  <button className="back-button" onClick={handleBackToChats}>
                    <ArrowLeft size={18} />
                  </button>
                  <h1 className="sidebar-title">Notifications</h1>
                </div>
              ) : (
                <h1 className="sidebar-title" onClick={handleNewChat} style={{ cursor: 'pointer' }}>Glow</h1>
              )}
            </div>
            <button
              className="close-button"
              onClick={onToggle}
              title="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Show navigation only in chats mode */}
          {viewMode === 'chats' && (
            <div className="sidebar-nav">
              {/* New chat button */}
              <button 
                className="nav-item new-chat-button"
                onClick={handleNewChat}
              >
                <Plus size={16} />
                <span>New chat</span>
              </button>

              {/* Navigation Links */}
              <div className="nav-links">
                <button 
                  className="nav-link"
                  onClick={() => navigate(`/profile/${currentUser?.username || 'archita'}`)}
                >
                  <User size={16} />
                  <span>Profile</span>
                </button>

                <button 
                  className="nav-link"
              onClick={() => navigate('/explore')}
                >
                  <Search size={16} />
                  <span>Explore</span>
                </button>

                <button 
                  className="nav-link"
                  onClick={handleNotifications}
                >
                  <Heart size={16} />
                  <span>Notifications</span>
                </button>

                <button 
                  className="nav-link logout-button"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="main-content-section">
            {viewMode === 'chats' ? (
              /* Conversations List */
                <div className="conversations-section">
                <h3 className="section-title">Chats</h3>
                <div className="conversations-list">
                  {loading ? (
                    <div className="loading-state">
                      <div className="loading-dots">
                        <div></div><div></div><div></div>
                      </div>
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="empty-state">
                      <p>No conversations yet</p>
                    </div>
                  ) : (
                    conversations.map((conversation) => (
                          <div
                          key={conversation.id}
                          className={`conversation-item ${
                            currentConversationId === conversation.id ? 'active' : ''
                          }`}
                            onClick={() => onSelectConversation(conversation.id)}
                          >
                            {renamingConversation === conversation.id ? (
                              <div className="conversation-rename">
                                <input
                                  type="text"
                                  value={newTitle}
                                  onChange={(e) => setNewTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRenameSubmit(conversation.id);
                                    } else if (e.key === 'Escape') {
                                      handleRenameCancel();
                                    }
                                  }}
                                  onBlur={() => handleRenameSubmit(conversation.id)}
                                  className="rename-input"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <>
                                <span className="conversation-title">{conversation.title}</span>
                                <div className="conversation-actions">
                                  <button
                                    className="conversation-menu-btn"
                                    onClick={(e) => handleDropdownToggle(conversation.id, e)}
                                  >
                                    <MoreHorizontal size={16} />
                                  </button>
                                  {activeDropdown === conversation.id && (
                                    <div className="conversation-dropdown">
                                      <button
                                        className="dropdown-item"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRenameStart(conversation.id, conversation.title);
                                        }}
                                      >
                                        <Edit2 size={14} />
                                        Rename
                                      </button>
                                      <button
                                        className="dropdown-item delete"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteConversation(conversation.id);
                                        }}
                                      >
                                        <Trash2 size={14} />
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Notifications Content */
              <div className="notifications-content">
                <div className="follow-requests-section">
                  <h3 className="section-title">Follow Requests</h3>
                  
                  {notificationsLoading ? (
                    <div className="loading-state">
                      <div className="loading-dots">
                        <div></div><div></div><div></div>
                      </div>
                    </div>
                  ) : followRequests.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">💫</div>
                      <p>No new follow requests</p>
                      <span>When someone wants to follow you, you'll see it here</span>
                    </div>
                  ) : (
                    <div className="requests-list">
                      {followRequests.map((request) => (
                        <div key={request.id} className="request-card">
                          <div className="user-profile">
                            <div className="user-avatar">
                              <User size={20} />
                            </div>
                            <div className="user-info">
                              <h4>{request.from_user.name}</h4>
                              <p>@{request.from_user.username}</p>
                              <span className="request-time">wants to follow you</span>
                            </div>
                          </div>
                          
                          <div className="request-actions">
                            <button 
                              className="decline-btn"
                              onClick={() => respondToFollowRequest(request.id, 'decline')}
                              title="Decline"
                            >
                              <UserX size={14} />
                            </button>
                            <button 
                              className="accept-btn"
                              onClick={() => respondToFollowRequest(request.id, 'accept')}
                              title="Accept"
                            >
                              <UserCheck size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </>
  );
};

export default ChatSidebar;
