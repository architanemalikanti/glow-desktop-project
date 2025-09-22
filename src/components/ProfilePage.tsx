import React, { useState, useEffect, useRef } from 'react';
import { Brain, Star, Quote, Home, Search, User, X, Clock, Lock, LogOut, Menu, UserPlus, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import ChatSidebar from './ChatSidebar';
import './ProfilePage.css';


interface Memory {
  id: number;
  fact: string;
  created_at: string;
  source_conversation_id?: number;
  themes?: string[];
  image_path?: string;
}

interface ConversationThemes {
  [theme: string]: number;
}

interface PersonalityImage {
  theme: string;
  image_path: string;
  weight: number;
}

interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  followers_count: number;
  following_count: number;
  relationship_status: 'own_profile' | 'following' | 'pending_outgoing' | 'pending_incoming' | 'none';
  has_access: boolean;
  is_private: boolean;
}


interface UserSong {
  title: string;
  artist: string;
  reason: string;
}

interface ProfilePageProps {
  onLogout?: () => void;
  currentUser?: any;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onLogout, currentUser, sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const [currentUserId] = useState(currentUser?.username || 'archu'); // Use logged in user or default to archu
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('profile');
  const [memoryThemes, setMemoryThemes] = useState<ConversationThemes>({});
  const [personalityImages, setPersonalityImages] = useState<PersonalityImage[]>([]);
  const [hiddenImages, setHiddenImages] = useState<Set<string>>(new Set());
  const [replacementImages, setReplacementImages] = useState<{[key: string]: PersonalityImage}>({});
  const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set());
  const [displayName, setDisplayName] = useState<string>('');
  const [userSong, setUserSong] = useState<UserSong | null>(null);
  const [songLoading, setSongLoading] = useState(true);
  const [lastMemoryCount, setLastMemoryCount] = useState(0);
  const [followActionLoading, setFollowActionLoading] = useState(false);
  const [overrideRelationshipStatus, setOverrideRelationshipStatus] = useState<string | null>(null);
  
  // WebSocket connection
  const socket = useRef<Socket | null>(null);
  
  // Determine the target user (from URL or default to current user)
  const targetUsername = username === 'me' ? currentUserId : (username || currentUserId);
  const isOwnProfile = targetUsername === currentUserId;
  
  // Get the current relationship status (with override support)
  const currentRelationshipStatus = overrideRelationshipStatus || userProfile?.relationship_status;

  // localStorage keys
  const HIDDEN_IMAGES_KEY = 'glow_hidden_images';
  const REPLACEMENT_IMAGES_KEY = 'glow_replacement_images';

  // Load hidden images from localStorage on component mount
  useEffect(() => {
    try {
      const savedHiddenImages = localStorage.getItem(HIDDEN_IMAGES_KEY);
      const savedReplacementImages = localStorage.getItem(REPLACEMENT_IMAGES_KEY);
      
      if (savedHiddenImages) {
        const hiddenArray = JSON.parse(savedHiddenImages);
        setHiddenImages(new Set(hiddenArray));
        console.log('Loaded hidden images from localStorage:', hiddenArray);
      }
      
      if (savedReplacementImages) {
        const replacements = JSON.parse(savedReplacementImages);
        setReplacementImages(replacements);
        console.log('Loaded replacement images from localStorage:', replacements);
      }
    } catch (error) {
      console.error('Error loading hidden images from localStorage:', error);
    }
  }, []);

  // Save hidden images to localStorage whenever hiddenImages changes
  useEffect(() => {
    try {
      const hiddenArray = Array.from(hiddenImages);
      localStorage.setItem(HIDDEN_IMAGES_KEY, JSON.stringify(hiddenArray));
      console.log('Saved hidden images to localStorage:', hiddenArray);
    } catch (error) {
      console.error('Error saving hidden images to localStorage:', error);
    }
  }, [hiddenImages]);

  // Save replacement images to localStorage whenever replacementImages changes
  useEffect(() => {
    try {
      localStorage.setItem(REPLACEMENT_IMAGES_KEY, JSON.stringify(replacementImages));
      console.log('Saved replacement images to localStorage:', Object.keys(replacementImages));
    } catch (error) {
      console.error('Error saving replacement images to localStorage:', error);
    }
  }, [replacementImages]);

  // Function to get a replacement image
  const getReplacementImage = async (excludeImages: string[]): Promise<PersonalityImage | null> => {
    try {
      const response = await fetch(`http://localhost:5001/api/replacement-image?exclude=${excludeImages.join(',')}`);
      const data = await response.json();
      if (data.success && data.replacement_image) {
        return data.replacement_image;
      }
    } catch (error) {
      console.error('Error fetching replacement image:', error);
    }
    return null;
  };

  // Function to hide an image and replace it with elegant animation
  // Delete memory from database (for memory pins with captions)
  const deleteMemory = async (memoryId: number) => {
    // Confirm deletion
    const confirmDelete = window.confirm('Are you sure you want to delete this memory? This action cannot be undone.');
    if (!confirmDelete) {
      return;
    }

    try {
      console.log('🗑️ Deleting memory:', memoryId);
      
      // Find the memory to show what we're deleting
      const memoryToDelete = memories.find(m => m.id === memoryId);
      const memoryText = memoryToDelete ? memoryToDelete.fact.substring(0, 50) + '...' : 'memory';
      
      const response = await fetch(`http://localhost:5001/api/memories/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        console.log('✅ Memory deleted successfully');
        
        // Remove the memory from local state immediately for instant UI feedback
        setMemories(prev => prev.filter(memory => memory.id !== memoryId));
        
        // Show success notification
        const notification = document.createElement('div');
        notification.textContent = `🗑️ Memory deleted: "${memoryText}"`;
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ef4444;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 500;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          max-width: 300px;
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.remove();
        }, 4000);
        
        // Refresh memories to ensure consistency with backend
        setTimeout(() => {
          fetchMemories();
        }, 500);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete memory');
      }
    } catch (error) {
      console.error('❌ Error deleting memory:', error);
      alert(`Failed to delete memory: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  const hideImage = async (imageKey: string, imagePath: string) => {
    console.log('Hiding image:', imageKey, imagePath);
    
    // Add to deleting state for animation
    setDeletingImages(prev => new Set(prev).add(imageKey));
    
    // Wait for fade-out animation
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Check if this is a memory or personality image
    if (imageKey.startsWith('memory-')) {
      // For memory images, hide permanently in database
      const memoryId = imageKey.replace('memory-', '');
      try {
        const response = await fetch('http://localhost:5001/api/hide-memory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            memory_id: memoryId,
            user_id: 'default_user'
          })
        });
        
        const data = await response.json();
        if (data.success) {
          console.log('✅ Memory hidden permanently in database');
          // Remove from local state to update UI immediately
          setMemories(prev => prev.filter(m => m.id.toString() !== memoryId));
          // Remove from deleting state
          setDeletingImages(prev => {
            const next = new Set(prev);
            next.delete(imageKey);
            return next;
          });
        } else {
          console.error('❌ Failed to hide memory:', data.error);
          // Remove from deleting state on error
          setDeletingImages(prev => {
            const next = new Set(prev);
            next.delete(imageKey);
            return next;
          });
        }
      } catch (error) {
        console.error('❌ Error hiding memory:', error);
        // Remove from deleting state on error
        setDeletingImages(prev => {
          const next = new Set(prev);
          next.delete(imageKey);
          return next;
        });
      }
    } else {
      // For personality images, use localStorage (temporary hiding)
      const newHiddenImages = new Set(hiddenImages);
      newHiddenImages.add(imageKey);
      setHiddenImages(newHiddenImages);
      
      // Get all currently used image paths to exclude from replacement
      const allUsedImages = [
        ...memories.filter(m => m.image_path).map(m => m.image_path!),
        ...personalityImages.map(p => p.image_path),
        ...Object.values(replacementImages).map(r => r.image_path)
      ];
      
      // Get replacement image
      const replacement = await getReplacementImage(allUsedImages);
      if (replacement) {
        setReplacementImages(prev => ({
          ...prev,
          [imageKey]: replacement
        }));
      }
      
      // Remove from deleting state
      setDeletingImages(prev => {
        const next = new Set(prev);
        next.delete(imageKey);
        return next;
      });
    }
  };

  // Function to clear all hidden images (for debugging/reset)
  const clearHiddenImages = () => {
    setHiddenImages(new Set());
    setReplacementImages({});
    localStorage.removeItem(HIDDEN_IMAGES_KEY);
    localStorage.removeItem(REPLACEMENT_IMAGES_KEY);
    console.log('Cleared all hidden images');
  };


  // Expose clearHiddenImages to window for debugging (remove in production)
  useEffect(() => {
    (window as any).clearHiddenImages = clearHiddenImages;
  }, []);

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      setProfileLoading(true);
      console.log('🔄 Fetching user profile...', { targetUsername, currentUserId });
      const response = await fetch(`http://localhost:5001/api/user-profile/${targetUsername}?user_id=${currentUserId}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Profile fetched successfully:', {
          username: data.profile.username,
          relationship_status: data.profile.relationship_status
        });
        setUserProfile(data.profile);
        // Also fetch the display name for the profile title
        fetchDisplayName(targetUsername);
      } else {
        console.error('❌ Error fetching profile:', data.error);
      }
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Fetch user's display name for profile title
  const fetchDisplayName = async (username: string) => {
    try {
      const response = await fetch(`http://localhost:5001/api/user-greeting/${username}`);
      const data = await response.json();
      
      if (data.success) {
        setDisplayName(data.given_name);
      } else {
        // Fallback to userProfile name if API fails
        if (userProfile) {
          setDisplayName(userProfile.name);
        }
      }
    } catch (error) {
      console.error('Error fetching display name:', error);
      // Fallback to userProfile name if API fails
      if (userProfile) {
        setDisplayName(userProfile.name);
      }
    }
  };

  // Fetch memories from API
  const fetchMemories = async () => {
    try {
      setMemoriesLoading(true);
      const response = await fetch(`http://localhost:5001/api/memories?user_id=${targetUsername}&current_user_id=${currentUserId}`);
      const data = await response.json();
          console.log('🧠 Memories API response:', data); // Debug log
          console.log('🧠 Total memories fetched:', data.memories ? data.memories.length : 0);
          console.log('🧠 Personality images:', data.personality_images ? data.personality_images.length : 0);
          console.log('🎭 Memory themes:', data.memory_themes || {});
          console.log('💬 Conversation themes:', data.conversation_themes || {});
          console.log('🎨 Combined themes used:', data.combined_themes || {});
      
      if (data.success) {
        if (data.is_private) {
          // Profile is private, show private view
          setMemories([]);
          setMemoryThemes({});
          setPersonalityImages([]);
        } else {
          const newMemories = data.memories || [];
          const newMemoryCount = newMemories.length;
          
          // Check if new memories were added
          if (lastMemoryCount > 0 && newMemoryCount > lastMemoryCount) {
            const newMemoryDiff = newMemoryCount - lastMemoryCount;
            console.log(`🎉 ${newMemoryDiff} new memory(ies) detected! Updating profile...`);
            
            // Optional: Show a brief notification (you can enhance this with a toast notification)
            if (isOwnProfile) {
              // Create a temporary notification element
              const notification = document.createElement('div');
              notification.innerHTML = `✨ ${newMemoryDiff} new memory(ies) added to your profile!`;
              notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                z-index: 9999;
                font-size: 14px;
                font-weight: 500;
                animation: slideIn 0.3s ease-out;
              `;
              
              // Add slide-in animation
              const style = document.createElement('style');
              style.textContent = `
                @keyframes slideIn {
                  from { transform: translateX(100%); opacity: 0; }
                  to { transform: translateX(0); opacity: 1; }
                }
              `;
              document.head.appendChild(style);
              document.body.appendChild(notification);
              
              // Remove notification after 3 seconds
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.style.animation = 'slideIn 0.3s ease-out reverse';
                  setTimeout(() => {
                    document.body.removeChild(notification);
                    document.head.removeChild(style);
                  }, 300);
                }
              }, 3000);
            }
          }
          
          setMemories(newMemories);
          setMemoryThemes(data.memory_themes || {});
          setPersonalityImages(data.personality_images || []);
          setLastMemoryCount(newMemoryCount);
        }
      }
    } catch (error) {
      console.error('Error fetching memories:', error);
    } finally {
      setMemoriesLoading(false);
    }
  };


  // Fetch user song
  const fetchUserSong = async () => {
    try {
      setSongLoading(true);
      // Add timestamp to prevent caching and ensure fresh song each time
      const timestamp = Date.now();
      const response = await fetch(`http://localhost:5001/api/user-song/${targetUsername}?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setUserSong(data.song);
      }
    } catch (error) {
      console.error('Error fetching user song:', error);
    } finally {
      setSongLoading(false);
    }
  };

  // Debug userProfile changes
  useEffect(() => {
    if (userProfile) {
      console.log('👤 UserProfile updated:', {
        username: userProfile.username,
        relationship_status: userProfile.relationship_status,
        override_status: overrideRelationshipStatus,
        timestamp: new Date().toISOString()
      });
      
      // Clear override if server data matches what we expect
      if (overrideRelationshipStatus && userProfile.relationship_status === overrideRelationshipStatus) {
        console.log('🎯 Server data matches override, clearing override');
        setOverrideRelationshipStatus(null);
      }
    }
  }, [userProfile, overrideRelationshipStatus]);

  // Initialize data
  useEffect(() => {
    fetchUserProfile();
    fetchMemories();
    fetchUserSong();
  }, [targetUsername, currentUserId]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    // Only connect for own profile to receive memory updates
    if (!isOwnProfile) return;

    console.log('🔌 Connecting to WebSocket for real-time memory updates...');
    
    // Initialize socket connection
    socket.current = io('http://localhost:5001', {
      transports: ['websocket', 'polling']
    });

    // Connection event handlers
    socket.current.on('connect', () => {
      console.log('✅ WebSocket connected!');
      
      // Stop fallback polling if it was running
      if ((socket.current as any).fallbackInterval) {
        clearInterval((socket.current as any).fallbackInterval);
        (socket.current as any).fallbackInterval = null;
        console.log('🔄 WebSocket reconnected - stopped fallback polling');
      }
      
      // Join user-specific room for targeted updates
      socket.current?.emit('join_user_room', { user_id: targetUsername });
    });

    socket.current.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      
      // Only start polling if not already polling
      if (!(socket.current as any).fallbackInterval) {
        console.log('🔄 WebSocket failed, falling back to polling every 10 seconds...');
        const fallbackInterval = setInterval(() => {
          console.log('🔄 Polling for new memories (WebSocket fallback)...');
          fetchMemories();
        }, 10000);
        
        // Store interval ID for cleanup
        (socket.current as any).fallbackInterval = fallbackInterval;
      }
    });

    socket.current.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
    });

    socket.current.on('room_joined', (data) => {
      console.log('🏠 Joined room:', data.room);
    });

    // Listen for memory updates
    socket.current.on('memory_updated', (data) => {
      console.log('📢 New memory received via WebSocket:', data);
      
      // Only update if it's for the current user
      if (data.user_id === targetUsername) {
        console.log('🔄 Refreshing memories due to real-time update...');
        
        // Show a brief notification
        const notification = document.createElement('div');
        notification.textContent = '✨ New memory added!';
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 20px;
          border-radius: 25px;
          font-weight: 500;
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
          notification.remove();
          style.remove();
        }, 3000);
        
        // Refresh memories to show the new one
        fetchMemories();
      }
    });

    // Cleanup on unmount
    return () => {
      if (socket.current) {
        console.log('🔌 Cleaning up WebSocket connection...');
        
        // Clear fallback polling if it exists
        if ((socket.current as any).fallbackInterval) {
          clearInterval((socket.current as any).fallbackInterval);
          console.log('🔄 Cleared fallback polling interval');
        }
        
        socket.current.emit('leave_user_room', { user_id: targetUsername });
        socket.current.disconnect();
        socket.current = null;
      }
    };
  }, [targetUsername, isOwnProfile]);

  // Immediate memory check on component mount or user change
  useEffect(() => {
    const checkForNewMemories = async () => {
      console.log('🔍 Checking for new memories on component load...');
      await fetchMemories();
    };
    
    checkForNewMemories();
  }, [targetUsername]); // Trigger when target user changes

  // Daily polling for memories (24-hour interval)
  useEffect(() => {
    console.log('🕐 Setting up daily memory polling...');
    
    // Poll every 24 hours (86400000 milliseconds)
    const dailyPollingInterval = setInterval(() => {
      console.log('🗓️ Daily memory refresh...');
      fetchMemories();
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    // Also poll every hour for more frequent updates
    const hourlyPollingInterval = setInterval(() => {
      console.log('🕐 Hourly memory refresh...');
      fetchMemories();
    }, 60 * 60 * 1000); // 1 hour
    
    // Cleanup intervals on unmount
    return () => {
      console.log('🧹 Cleaning up memory polling intervals...');
      clearInterval(dailyPollingInterval);
      clearInterval(hourlyPollingInterval);
    };
  }, [targetUsername]); // Reset intervals when target user changes
  
  // Note: WebSocket provides real-time updates, with fallback polling if connection fails
  // The manual refresh button is still available for users who want to force refresh

  // Send follow request
  const sendFollowRequest = async () => {
    if (!userProfile || followActionLoading) return;
    
    console.log('🔄 Sending follow request...', { from: currentUserId, to: userProfile.username });
    setFollowActionLoading(true);
    
    try {
      const response = await fetch('http://localhost:5001/api/send-follow-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_user_id: currentUserId,
          to_username: userProfile.username
        })
      });

      const data = await response.json();
      console.log('📤 Follow request response:', data);
      
      if (data.success) {
        console.log('✅ Follow request sent successfully, updating UI immediately...');
        
        // IMMEDIATELY override the relationship status to force UI update
        setOverrideRelationshipStatus('pending_outgoing');
        console.log('🔄 Override status set to pending_outgoing - UI should show Requested button');
        
        // Also update the userProfile for consistency
        setUserProfile(prev => prev ? { 
          ...prev, 
          relationship_status: 'pending_outgoing' as const
        } : null);
        
        console.log('⚡ Both override and profile state updated!');
      } else {
        console.error('❌ Follow request failed:', data.error);
        alert(data.error);
      }
    } catch (error) {
      console.error('❌ Error sending follow request:', error);
    } finally {
      setFollowActionLoading(false);
    }
  };

  // Cancel follow request
  const cancelFollowRequest = async () => {
    if (!userProfile || followActionLoading) return;
    
    console.log('🔄 Cancelling follow request...', { from: currentUserId, to: userProfile.username });
    setFollowActionLoading(true);
    
    try {
      const response = await fetch('http://localhost:5001/api/cancel-follow-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_user_id: currentUserId,
          to_username: userProfile.username
        })
      });

      const data = await response.json();
      console.log('📤 Cancel follow request response:', data);
      
      if (data.success) {
        console.log('✅ Follow request cancelled successfully, updating UI immediately...');
        
        // IMMEDIATELY override the relationship status to force UI update
        setOverrideRelationshipStatus('none');
        console.log('🔄 Override status set to none - UI should show Follow button');
        
        // Also update the userProfile for consistency
        setUserProfile(prev => prev ? { 
          ...prev, 
          relationship_status: 'none' as const
        } : null);
        
        console.log('⚡ Both override and profile state updated!');
      } else {
        console.error('❌ Cancel follow request failed:', data.error);
        alert(data.error);
      }
    } catch (error) {
      console.error('❌ Error cancelling follow request:', error);
    } finally {
      setFollowActionLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (data.success && onLogout) {
        onLogout();
      }
    } catch (error) {
      console.error('Error logging out:', error);
      // Still call onLogout even if API fails
      if (onLogout) {
        onLogout();
      }
    }
  };



  // Dummy handlers for sidebar (ProfilePage doesn't need chat functionality)
  const handleNewChat = () => {
    navigate('/chat');
  };

  const handleSelectConversation = (conversationId: string) => {
    console.log('Selected conversation:', conversationId);
    navigate(`/chat/${conversationId}`);
  };

  return (
    <div className={`profile-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentConversationId={undefined}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        currentUser={currentUser}
        onLogout={onLogout || (() => {})}
        onUpdateConversationTitle={() => {}} // No need for title updates on profile page
      />

      {/* Menu Button */}
      <motion.button
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
        }}
        whileHover={{ 
          scale: 1.05,
          background: 'rgba(255, 255, 255, 0.25)',
          color: 'rgba(0, 0, 0, 1)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.1)',
        }}
        whileTap={{ scale: 0.95 }}
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
      </motion.button>


      {/* Main Content */}
      <main className="profile-main">
        {/* Profile Title Section */}
        <motion.div
          className="profile-title-section"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {profileLoading ? (
            <div className="loading-profile">
              <div className="loading-spinner"></div>
              <p>Loading profile...</p>
            </div>
          ) : userProfile ? (
            <>
              <div className="profile-header">
                <div className="profile-info">
                  <h1 className="profile-title">
                    <span className="gradient-text">who is {(displayName || userProfile.name).toLowerCase()}?</span>
                  </h1>
                  <p className="profile-subtitle">
                    <span className="gradient-text-subtitle">
                      {userProfile.is_private && !userProfile.has_access ? 
                        "this profile is private" : 
                        "a glimpse into my world through memories"
                      }
                    </span>
                  </p>
                  <div className="profile-stats">
                    <span>{userProfile.followers_count} followers</span>
                    <span>{userProfile.following_count} following</span>
                    {isOwnProfile && (
                      <button 
                        className="refresh-memories-btn"
                        onClick={() => {
                          console.log('🔄 Manual refresh triggered');
                          fetchMemories();
                        }}
                        title="Refresh memories"
                      >
                        refresh
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Social Actions */}
                {!isOwnProfile && (() => {
                  // DEBUG: Log what button should be rendered
                  console.log('🎯 Button rendering logic:', {
                    userProfile_exists: !!userProfile,
                    original_relationship_status: userProfile?.relationship_status,
                    override_relationship_status: overrideRelationshipStatus,
                    current_relationship_status: currentRelationshipStatus,
                    followActionLoading,
                    profileLoading,
                    shouldShowFollow: currentRelationshipStatus === 'none',
                    shouldShowRequested: currentRelationshipStatus === 'pending_outgoing',
                    shouldShowFollowing: currentRelationshipStatus === 'following',
                    shouldShowWantsToFollow: currentRelationshipStatus === 'pending_incoming'
                  });
                  
                  return (
                    <div className="social-actions">
                      {currentRelationshipStatus === 'none' && (
                      <button 
                        className="follow-btn" 
                        onClick={sendFollowRequest}
                        disabled={followActionLoading || profileLoading}
                      >
                        <UserPlus size={16} />
                        {followActionLoading ? 'Sending...' : 'Follow'}
                      </button>
                    )}
                    {currentRelationshipStatus === 'following' && (
                      <button className="following-btn">
                        <UserCheck size={16} />
                        Following
                      </button>
                    )}
                    {currentRelationshipStatus === 'pending_outgoing' && (
                      <button 
                        className="pending-btn" 
                        onClick={cancelFollowRequest}
                        disabled={followActionLoading || profileLoading}
                      >
                        <Clock size={16} />
                        {followActionLoading ? 'Cancelling...' : 'Requested'}
                      </button>
                    )}
                      {currentRelationshipStatus === 'pending_incoming' && (
                        <button className="pending-btn">
                          <Clock size={16} />
                          Wants to follow you
                        </button>
                      )}
                    </div>
                  );
                })()}

              </div>
            </>
          ) : (
            <div className="error-state">
              <h1 className="profile-title">
                <span className="gradient-text">user not found</span>
              </h1>
              <p className="profile-subtitle">
                <span className="gradient-text-subtitle">this user doesn't exist</span>
              </p>
            </div>
          )}
        </motion.div>


        {/* WHO YOU ARE COLLAGE */}
        {userProfile && userProfile.is_private && !userProfile.has_access ? (
          // Private Profile View
          <motion.div 
            className="private-profile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <div className="private-content">
              <Lock size={48} className="private-icon" />
              <h3>This Profile is Private</h3>
              <p>Follow @{userProfile.username} to see their memories and photos.</p>
            </div>
          </motion.div>
        ) : (
          // Public/Accessible Profile View
          <motion.div 
            className="memories-collage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            {memoriesLoading ? (
              <div className="collage-loading">
                <div className="loading-dots">
                  <div></div><div></div><div></div>
                    </div>
                <p>crafting your story...</p>
                  </div>
            ) : memories.length > 0 ? (
            <div className="pinterest-board">
              {/* Song Card - ALWAYS FIRST */}
              {userSong && !songLoading && (
                <motion.div
                  className="pinterest-pin song-pin pin-wide"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ 
                    duration: 0.6, 
                    delay: 0.1, // Very early delay to appear first
                    type: "spring",
                    stiffness: 100
                  }}
                >
                  <div className="pin-content song-card-content">
                    <div className="song-card-icon">🎵</div>
                    <h3 className="song-card-title">"{userSong.title}"</h3>
                    <p className="song-card-artist">by {userSong.artist}</p>
                    <p className="song-card-reason">{userSong.reason}</p>
                  </div>
                </motion.div>
              )}
              
              {/* Memory pins with captions - AFTER SONG */}
              {memories.filter(memory => memory.image_path).map((memory, index) => {
                const layouts = [
                  'pin-small',
                  'pin-medium', 
                  'pin-large',
                  'pin-wide',
                  'pin-tall'
                ];
                const layout = layouts[index % layouts.length];
                const memoryKey = `memory-${memory.id}`;
                const isDeleting = deletingImages.has(memoryKey);
                
                return (
                  <motion.div
                    key={memory.id}
                    className={`pinterest-pin memory-pin ${layout}`}
                    style={{ order: index }} // Ensures memories appear first
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: isDeleting ? 0 : 1, 
                      scale: isDeleting ? 0.8 : 1,
                      rotateY: isDeleting ? 90 : 0
                    }}
                    transition={{ 
                      duration: isDeleting ? 0.3 : 0.6, 
                      delay: isDeleting ? 0 : index * 0.1 + 0.3,
                      type: isDeleting ? "tween" : "spring",
                      stiffness: 100,
                      ease: isDeleting ? "easeInOut" : "easeOut"
                    }}
                    whileHover={{ 
                      scale: isDeleting ? 0.8 : 1.02,
                      transition: { duration: 0.2 }
                    }}
                  >
                    <div className="pin-image">
                      {memory.image_path ? (
                        <>
                          <img 
                            src={memory.image_path} 
                            alt={`Memory about ${memory.themes?.[0] || 'life'}`}
                            onLoad={() => console.log('✅ Image loaded:', memory.image_path)}
                            onError={(e) => {
                              console.error('❌ Image failed to load:', memory.image_path);
                              // Show fallback gradient instead of hiding
                              const target = e.currentTarget as HTMLImageElement;
                              target.style.display = 'none';
                              const container = target.parentElement;
                              if (container) {
                                container.classList.add('theme-image', 'default-theme');
                              }
                            }}
                          />
                          {isOwnProfile && (
                            <button 
                              className="delete-image-btn"
                              onClick={() => deleteMemory(memory.id)}
                              title="Delete this memory"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                    <div className="pin-content">
                      <div className="pin-overlay">
                        {index % 3 === 0 && <Quote className="pin-icon" size={16} />}
                        {index % 4 === 0 && <Star className="pin-icon" size={14} />}
                      </div>
                      <p className="pin-caption">{memory.fact}</p>
                      <span className="pin-date">
                        {new Date(memory.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                  </div>
                  </motion.div>
                );
              })}
              
              {/* Visual-only personality pins - AFTER MEMORIES */}
              {personalityImages.map((personalityImg, index) => {
                const layouts = ['pin-small', 'pin-medium', 'pin-large', 'pin-wide', 'pin-tall'];
                const layout = layouts[index % layouts.length];
                const memoriesWithImages = memories.filter(m => m.image_path);
                const pinKey = `personality-${personalityImg.theme}-${index}`;
                
                // Check if this personality pin is hidden and has a replacement
                const isHidden = hiddenImages.has(pinKey);
                const replacement = replacementImages[pinKey];
                const displayImage = isHidden && replacement ? replacement : personalityImg;
                const isDeleting = deletingImages.has(pinKey);
                const hasReplacement = isHidden && replacement;
                
                return (
                  <motion.div
                    key={`personality-${personalityImg.theme}-${index}`}
                    className={`pinterest-pin personality-pin ${layout}`}
                    style={{ order: memoriesWithImages.length + index + 100 }} // Ensures personality pins come after memories
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: isDeleting ? 0 : 1, 
                      scale: isDeleting ? 0.8 : (hasReplacement ? 1.05 : 1),
                      rotateY: isDeleting ? -90 : 0,
                      y: hasReplacement ? -5 : 0
                    }}
                    transition={{ 
                      duration: isDeleting ? 0.3 : (hasReplacement ? 0.5 : 0.6), 
                      delay: isDeleting ? 0 : (hasReplacement ? 0.2 : (memoriesWithImages.length + index) * 0.1 + 0.3),
                      type: isDeleting ? "tween" : "spring",
                      stiffness: 100,
                      ease: isDeleting ? "easeInOut" : "easeOut"
                    }}
                    whileHover={{ 
                      scale: isDeleting ? 0.8 : 1.02,
                      transition: { duration: 0.2 }
                    }}
                  >
                    <div className="pin-image">
                      <img 
                        src={displayImage.image_path} 
                        alt={`${displayImage.theme} vibes`}
                        onLoad={() => console.log('✅ Personality image loaded:', displayImage.image_path)}
                        onError={(e) => {
                          console.error('❌ Personality image failed to load:', displayImage.image_path);
                          // Fallback to gradient
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = 'none';
                          const container = target.parentElement;
                          if (container) {
                            container.innerHTML = `<div class="theme-image ${displayImage.theme.toLowerCase()}-theme"></div>`;
                          }
                        }}
                      />
                      {isOwnProfile && (
                        <button 
                          className="delete-image-btn"
                          onClick={() => hideImage(pinKey, displayImage.image_path)}
                          title="Hide this image"
                        >
                          <X size={16} />
                        </button>
                      )}
                  </div>
                    {/* No pin-content div = no captions, pure visual */}
              </motion.div>
                );
              })}

          </div>
          ) : (
            <div className="no-memories-collage">
              <Brain size={48} />
              <h3>your story awaits</h3>
              <p>start a conversation to begin building your memory collage</p>
        </div>
          )}

            {/* Memory Counter */}
            <motion.div
              className="memory-counter"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
            >
              <span className="counter-number">{memories.length}</span>
              <span className="counter-label">memories collected</span>
            </motion.div>
          </motion.div>
        )}  {/* Close the private profile conditional */}
      </main>
    </div>
  );
};

export default ProfilePage;
