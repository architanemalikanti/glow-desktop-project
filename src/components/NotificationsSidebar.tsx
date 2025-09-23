import React, { useState, useEffect } from 'react';
import { X, UserCheck, UserX, User } from 'lucide-react';
import { config } from '../config';
import './NotificationsSidebar.css';

interface FollowRequest {
  id: string;
  from_user: {
    id: string;
    username: string;
    name: string;
  };
  created_at: string;
}

interface NotificationsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
}

const NotificationsSidebar: React.FC<NotificationsSidebarProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser?.username) {
      fetchFollowRequests();
    }
  }, [isOpen, currentUser]);

  const fetchFollowRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.API_URL}/api/follow-requests?user_id=${currentUser.username}`);
      if (response.ok) {
        const data = await response.json();
        setFollowRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching follow requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const respondToFollowRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      const response = await fetch(`${config.API_URL}/api/respond-follow-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: requestId,
          action,
          user_id: currentUser.username
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

  if (!isOpen) return null;

  return (
    <div className="notifications-sidebar-overlay">
      <div className="notifications-sidebar">
        <div className="notifications-header">
          <h2>Notifications</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="notifications-content">
          <div className="follow-requests-section">
            <h3>Follow Requests</h3>
            
            {loading ? (
              <div className="loading-state">Loading...</div>
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
                        <User size={24} />
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
                        <UserX size={16} />
                      </button>
                      <button 
                        className="accept-btn"
                        onClick={() => respondToFollowRequest(request.id, 'accept')}
                        title="Accept"
                      >
                        <UserCheck size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsSidebar;
