import React, { useState, useRef, useEffect } from 'react';
import { Send, Home, User, Search, Copy, RotateCcw, Menu, Plus, Paperclip, FileText, Mic, Square, X, Check, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { config } from '../config';
import CodeBlock from './CodeBlock';
import ChatSidebar from './ChatSidebar';
import './NewChatInterface.css';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  edited?: boolean;
}

interface NewChatInterfaceProps {
  currentUser?: any;
  onLogout: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const NewChatInterface: React.FC<NewChatInterfaceProps> = ({ currentUser, onLogout, sidebarOpen, setSidebarOpen }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { conversationId: urlConversationId } = useParams<{ conversationId: string }>();
  const [userGivenName, setUserGivenName] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  
  // Function to update conversation title (will be passed to ChatSidebar)
  const [sidebarUpdateTitle, setSidebarUpdateTitle] = useState<((id: string, title: string) => void) | null>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Function to process math formatting in AI responses
  const formatMathContent = (content: string): string => {
    let formattedContent = content;
    
    // Replace [ ... ] with $ ... $ for inline math (only if not already in $ or $$)
    formattedContent = formattedContent.replace(/(?<!\$)\[([^\[\]]+)\](?!\$)/g, '$$$1$$');
    
    // Replace [[ ... ]] with $$ ... $$ for block math (only if not already in $$)
    formattedContent = formattedContent.replace(/(?<!\$)\[\[([^\[\]]+)\]\](?!\$)/g, '\n$$$$$$1$$$$$$\n');
    
    // Add proper spacing for common math expressions
    formattedContent = formattedContent.replace(/\$([^$]+)\$/g, (match, mathContent) => {
      let formatted = mathContent;
      // Add spacing before differential elements
      formatted = formatted.replace(/(\w)\s*d([xyz])/g, '$1\\,d$2');
      // Add spacing between function and variable
      formatted = formatted.replace(/(\w)\s*\(/g, '$1\\,(');
      return `$${formatted}$`;
    });
    
    // Handle block math spacing
    formattedContent = formattedContent.replace(/\$\$([^$]+)\$\$/g, (match, mathContent) => {
      let formatted = mathContent;
      // Add spacing before differential elements
      formatted = formatted.replace(/(\w)\s*d([xyz])/g, '$1\\,d$2');
      // Add spacing between function and variable
      formatted = formatted.replace(/(\w)\s*\(/g, '$1\\,(');
      return `$$${formatted}$$`;
    });
    
    return formattedContent;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch user's given name for greeting
  useEffect(() => {
    const fetchUserGreeting = async () => {
      if (currentUser?.username) {
        try {
          const response = await fetch(`${config.API_URL}/api/user-greeting/${currentUser.username}`);
          const data = await response.json();
          
          if (data.success) {
            setUserGivenName(data.given_name);
          } else {
            // Fallback to currentUser data if API fails
            setUserGivenName(currentUser.given_name || currentUser.name || currentUser.username);
          }
        } catch (error) {
          console.error('Error fetching user greeting:', error);
          // Fallback to currentUser data if API fails
          setUserGivenName(currentUser.given_name || currentUser.name || currentUser.username);
        }
      }
    };

    fetchUserGreeting();
  }, [currentUser]);

  // Load conversation from URL parameter
  useEffect(() => {
    if (urlConversationId) {
      loadConversation(urlConversationId);
    }
  }, [urlConversationId]);

  const loadConversation = async (convId: string) => {
    try {
      const response = await fetch(`${config.API_URL}/api/conversations/${convId}`);
      const data = await response.json();
      
      if (data.conversation) {
        // Convert backend messages to frontend format
        const formattedMessages: Message[] = data.conversation.messages
          .filter((msg: any) => msg.role !== 'system') // Filter out system messages
          .map((msg: any) => ({
            id: msg.id,
            text: msg.content,
            sender: msg.role === 'user' ? 'user' : 'ai',
            timestamp: new Date(msg.created_at),
            edited: msg.edited || false
          }));
        
        setMessages(formattedMessages);
        setConversationId(convId);
        setSidebarOpen(false);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setInputText('');
    setSidebarOpen(false);
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    
    // Auto-resize textarea - reset to auto first, then set to scrollHeight
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setSelectedFiles([]);
    
    // Reset textarea height when message is sent
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    setIsTyping(true);

    // Call streaming backend API
    try {
      const response = await fetch(`${config.API_URL}/api/chatOpenAI`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputText,
          user_id: currentUser?.username || 'archu',
          conversation_id: conversationId || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Create a placeholder AI message that will be updated as we stream
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessage: Message = {
        id: aiMessageId,
        text: "",
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false); // Turn off typing indicator since we're about to show streaming text

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'chunk' && data.content) {
                fullContent += data.content;
                
                // Format the content with proper math styling
                const formattedContent = formatMathContent(fullContent);
                
                // Update the AI message with the new formatted content
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, text: formattedContent }
                    : msg
                ));
              } else if (data.type === 'complete') {
                // Save conversation ID for future messages
                if (!conversationId && data.conversation_id) {
                  setConversationId(data.conversation_id);
                }
                
                // Update conversation title if available
                if (data.conversation_title && data.conversation_id) {
                  console.log('💬 Received title update:', data.conversation_title);
                  
                  // Update the sidebar immediately
                  if (sidebarUpdateTitle) {
                    sidebarUpdateTitle(data.conversation_id, data.conversation_title);
                  }
                }
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (parseError) {
              // Skip malformed JSON
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error calling backend:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting right now. Please try again!",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
      case 'md':
        return <FileText size={16} />;
      default:
        return <Paperclip size={16} />;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up MediaRecorder with optimized settings
      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus', // Opus codec for better compression
        audioBitsPerSecond: 32000 // Reduced bitrate for smaller files
      };
      
      // Fallback for browsers that don't support the preferred format
      const mediaRecorder = MediaRecorder.isTypeSupported(options.mimeType!) 
        ? new MediaRecorder(stream, options)
        : new MediaRecorder(stream);
        
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up Web Audio API for audio visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128; // Reduced from 256 for better performance
      analyser.smoothingTimeConstant = 0.3; // Reduced from 0.8 for faster response
      
      source.connect(analyser);
      analyserRef.current = analyser;

      // Optimized audio level monitoring with throttling
      let lastUpdateTime = 0;
      const updateInterval = 50; // Update every 50ms instead of every frame
      
      const updateAudioLevel = () => {
        if (analyserRef.current && isRecording) {
          const now = performance.now();
          
          if (now - lastUpdateTime >= updateInterval) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteTimeDomainData(dataArray); // Changed to time domain for better responsiveness
            
            // Calculate RMS (Root Mean Square) for more accurate audio level
            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const normalized = (dataArray[i] - 128) / 128;
              sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length);
            const normalizedLevel = Math.min(rms * 3, 1); // Amplify for better visual response
            
            setAudioLevel(normalizedLevel);
            lastUpdateTime = now;
          }
          
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop audio level monitoring
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        // Clean up audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        setAudioLevel(0);
        
        // Only process if there are chunks (not cancelled)
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          transcribeAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      updateAudioLevel();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop recording without processing
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear chunks to prevent processing
      audioChunksRef.current = [];
    }
  };

  const confirmRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // This will trigger the onstop event which processes the audio
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      
      console.log('Starting transcription...', {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      const formData = new FormData();
      // Use WAV format for better compatibility
      formData.append('audio', audioBlob, 'recording.wav');

      // Create abort controller for timeout (better browser support)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(`${config.API_URL}/api/transcribe`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('Transcription successful:', data.text);
        // Add transcribed text to input
        setInputText(prev => prev + (prev ? ' ' : '') + data.text);
        
        // Focus textarea
        textareaRef.current?.focus();
      } else {
        throw new Error(data.error || 'Transcription failed');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          alert('Transcription timed out. Please try a shorter recording.');
        } else {
          alert(`Failed to transcribe audio: ${error.message}`);
        }
      } else {
        alert('Failed to transcribe audio. Please try again.');
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicrophoneClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleEditMessage = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setEditingText(currentText);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingText.trim()) return;

    try {
      // First, update the message in the database
      const response = await fetch(`${config.API_URL}/api/messages/${editingMessageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_content: editingText.trim()
        })
      });

      if (response.ok) {
        // Find the index of the edited message
        const editedMessageIndex = messages.findIndex(msg => msg.id === editingMessageId);
        
        if (editedMessageIndex !== -1) {
          // Remove all messages after the edited message (including AI responses)
          const messagesUpToEdit = messages.slice(0, editedMessageIndex + 1);
          
          // Update the edited message
          const updatedMessages = messagesUpToEdit.map(msg => 
            msg.id === editingMessageId 
              ? { ...msg, text: editingText.trim(), edited: true }
              : msg
          );
          
          setMessages(updatedMessages);
          
          // Clear editing state
          setEditingMessageId(null);
          setEditingText('');
          
          // Generate new AI response based on the edited message
          setIsTyping(true);
          
          try {
            const aiResponse = await fetch(`${config.API_URL}/api/chatOpenAI`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: editingText.trim(),
                user_id: currentUser?.username || 'archu',
                conversation_id: conversationId,
                regenerate_from_message: editingMessageId
              })
            });

            const aiData = await aiResponse.json();

            if (aiData.success) {
              // Update messages with the complete conversation from backend
              if (aiData.conversation && aiData.conversation.messages) {
                const formattedMessages: Message[] = aiData.conversation.messages
                  .filter((msg: any) => msg.role !== 'system')
                  .map((msg: any) => ({
                    id: msg.id,
                    text: msg.content,
                    sender: msg.role === 'user' ? 'user' : 'ai',
                    timestamp: new Date(msg.created_at),
                    edited: msg.edited || false
                  }));
                
                setMessages(formattedMessages);
              }
            } else {
              throw new Error(aiData.error || 'Failed to get AI response');
            }
          } catch (aiError) {
            console.error('Error getting AI response:', aiError);
            // Keep the edited message but show error for AI response
            const errorMessage: Message = {
              id: (Date.now() + 1).toString(),
              text: "Sorry, I'm having trouble generating a response to your edited message. Please try again!",
              sender: 'ai',
              timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
          } finally {
            setIsTyping(false);
          }
        }
      } else {
        console.error('Failed to edit message');
        alert('Failed to edit message. Please try again.');
      }
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Error editing message. Please try again.');
    }
  };

  return (
    <div className={`new-chat-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentConversationId={conversationId || undefined}
        onSelectConversation={loadConversation}
        onNewChat={startNewChat}
        currentUser={currentUser}
        onLogout={onLogout}
        onUpdateConversationTitle={setSidebarUpdateTitle}
      />

      {/* Menu Button */}
      <motion.button
        className={`menu-button ${sidebarOpen ? 'hidden' : ''}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: sidebarOpen ? 0 : 1 }}
        transition={{ duration: 0.3 }}
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


      {/* Main Chat Area */}
      <div className="chat-main">
        {/* Welcome Header */}
        {messages.length === 0 && (
          <motion.div 
            className="welcome-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h1 className="welcome-title">Hi, {userGivenName || 'there'}</h1>
            <p className="welcome-subtitle">What would you like to explore today?</p>
            
          </motion.div>
        )}

        {/* Messages */}
        <div className="messages-area">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`message ${message.sender}`}
              >
                {message.sender === 'user' ? (
                  <div className="user-message-content">
                    {editingMessageId === message.id ? (
                      // Edit mode
                      <div className="edit-message-container">
                        <textarea
                          className="edit-message-textarea"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          placeholder="Edit your message..."
                          autoFocus
                        />
                        <div className="edit-message-actions">
                          <button 
                            className="edit-action-btn cancel-btn"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                          <button 
                            className="edit-action-btn send-btn"
                            onClick={handleSaveEdit}
                            disabled={!editingText.trim()}
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Normal message view
                      <>
              <div className="message-bubble">
                {message.text}
              </div>
                        <div className="message-actions">
                          <button 
                            className="action-btn" 
                            data-tooltip="Edit message"
                            onClick={() => handleEditMessage(message.id, message.text)}
                          >
                            <Edit size={8} />
                          </button>
                          <button 
                            className="action-btn" 
                            data-tooltip="Copy"
                            onClick={() => {
                              navigator.clipboard.writeText(message.text)
                                .then(() => {
                                  console.log('Text copied to clipboard');
                                })
                                .catch(err => {
                                  console.error('Failed to copy text: ', err);
                                });
                            }}
                          >
                            <Copy size={8} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="ai-message-content">
                    <div className="ai-message-text">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          code: ({ className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !className;
                            return !isInline && match ? (
                              <CodeBlock className={className}>
                                {String(children).replace(/\n$/, '')}
                              </CodeBlock>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {message.text}
                      </ReactMarkdown>
                    </div>
                    <div className="message-actions">
                      <button 
                        className="action-btn" 
                        data-tooltip="Copy"
                        onClick={() => {
                          navigator.clipboard.writeText(message.text)
                            .then(() => {
                              // Optional: Show a brief success message
                              console.log('Text copied to clipboard');
                            })
                            .catch(err => {
                              console.error('Failed to copy text: ', err);
                            });
                        }}
                      >
                        <Copy size={10} />
                      </button>
                      <button className="action-btn" data-tooltip="Try again...">
                        <RotateCcw size={10} />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="message ai typing"
            >
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* File Preview Section */}
        {selectedFiles.length > 0 && (
          <motion.div 
            className="file-preview-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="file-preview-list">
              {selectedFiles.map((file, index) => (
                <div key={index} className="file-preview-item">
                  <div className="file-info">
                    {getFileIcon(file.name)}
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <button
                    className="remove-file-btn"
                    onClick={() => removeFile(index)}
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}


        {/* Search Input */}
        <motion.div 
          className="search-container"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className={`search-wrapper ${isRecording ? 'recording-mode' : ''}`}>
            {!isRecording ? (
              <>
                {/* File Upload Button */}
                <motion.button
                  className="file-upload-btn"
                  onClick={handleFileUpload}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Upload files"
                >
                  <Plus size={18} />
                </motion.button>
                
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.odt,.rtf,.txt,.md,.xlsx,.csv,.ods,.pptx,.odp,.py,.java,.cpp,.js,.html,.css,.json,.xml,.png,.jpg,.jpeg,.gif,.svg,.mp3,.wav,.m4a"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                
                <Search className="search-icon" size={20} />
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask anything"
                  className="search-input"
                  style={{ textAlign: 'left', resize: 'none' }}
                  rows={1}
                />
                
                {/* Microphone Button */}
                <motion.button
                  className={`mic-btn ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''}`}
                  onClick={handleMicrophoneClick}
                  disabled={isTranscribing}
                  whileHover={!isRecording ? { scale: 1.05 } : {}}
                  whileTap={!isRecording ? { scale: 0.95 } : {}}
                  title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Start recording'}
                >
                  {isTranscribing ? (
                    <div className="transcribing-spinner" />
                  ) : isRecording ? (
                    <Square size={18} />
                  ) : (
                    <Mic size={18} />
                  )}
                </motion.button>
                
                {/* Send Button */}
                <motion.button
                  className={`send-btn ${inputText.trim() ? 'enabled' : 'disabled'}`}
                  onClick={handleSendMessage}
                  disabled={!inputText.trim()}
                  whileHover={inputText.trim() ? { scale: 1.05 } : {}}
                  whileTap={inputText.trim() ? { scale: 0.95 } : {}}
                  title={inputText.trim() ? 'Send message' : 'Type a message to send'}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                >
                  <Send size={18} />
                </motion.button>
              </>
            ) : (
              <>
                {/* Recording Interface with Sound Waves */}
                <div className="recording-interface">
                  {/* Cancel Button */}
                  <motion.button
                    className="recording-control cancel-btn"
                    onClick={cancelRecording}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Cancel recording"
                  >
                    <X size={20} />
                  </motion.button>
                  
                  {/* Sound Waves Container */}
                  <div className="sound-waves-container">
                    <div className="sound-waves">
                      {[...Array(15)].map((_, index) => {
                        const delay = index * 0.08;
                        const baseHeight = 10 + (index % 3) * 4; // Reduced randomness for better performance
                        const multiplier = 0.6 + (index % 4) * 0.2; // Static multiplier instead of random
                        
                        return (
                          <motion.div
                            key={index}
                            className="sound-wave"
                            style={{
                              height: `${baseHeight}px`,
                              animationDelay: `${delay}s`
                            }}
                            animate={{
                              scaleY: 0.5 + (audioLevel * 1.8 * multiplier),
                              opacity: 0.4 + (audioLevel * 0.6)
                            }}
                            transition={{
                              duration: 0.05, // Faster transition
                              ease: "easeOut"
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Confirm Button */}
                  <motion.button
                    className="recording-control confirm-btn"
                    onClick={confirmRecording}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Confirm recording"
                  >
                    <Check size={20} />
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NewChatInterface;
