// Frontend configuration
export const config = {
  // API URL - defaults to localhost for development
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:5001',
  
  // WebSocket URL - defaults to same as API URL
  WS_URL: process.env.REACT_APP_WS_URL || process.env.REACT_APP_API_URL || 'http://localhost:5001',
  
  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

export default config;
