# Glow - Social AI Chat Platform ✨

A modern social networking platform that combines AI chat with Pinterest-style profiles and character personas. Connect with like-minded people, discover your network, and get help with anything from housing to career advice!

## Features 🌟

### 🤖 AI Chat Interface
- Engaging chat experience with personality-driven responses
- Character personas like Blair Waldorf, Rory Gilmore, and Serena van der Woodsen
- Smart suggestions for network queries
- Beautiful, modern UI with glassmorphism effects

### 👤 Pinterest-Style Profiles
- "She's a girl written by..." character persona system
- Visual post grid with different content types (thoughts, moments, asks, offers)
- Interest tags and skills showcase
- Connection stats and activity tracking

### 🔍 Social Network Discovery
- Advanced people search with smart filtering
- Find people who can help with specific needs (housing, jobs, travel)
- Interest-based matching
- Quick search suggestions for common requests

### 🎨 Modern Design
- Youthful but sophisticated aesthetic
- Gradient backgrounds and glassmorphism effects
- Smooth animations with Framer Motion
- Fully responsive design
- Custom fonts (Inter + Playfair Display)

## Tech Stack 💻

- **Frontend**: React 18 with TypeScript
- **Routing**: React Router DOM
- **Styling**: CSS-in-JS with custom glassmorphism effects
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Fonts**: Google Fonts (Inter, Playfair Display)

## Getting Started 🚀

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Open your browser** and navigate to `http://localhost:3000`

## Project Structure 📁

```
src/
├── components/
│   ├── Navbar.tsx          # Navigation with glassmorphism
│   ├── ChatInterface.tsx   # AI chat with personas
│   ├── ProfilePage.tsx     # Pinterest-style profiles
│   └── PeopleSearch.tsx    # Social discovery
├── App.tsx                 # Main app with routing
├── App.css                 # App-level styles
├── index.tsx               # React entry point
└── index.css               # Global styles & utilities
```

## Key Components 🧩

### ChatInterface
- AI-powered conversations with character personas
- Typing indicators and smooth animations
- Suggested questions for network queries
- Real-time message handling

### ProfilePage
- Pinterest-style post grid layout
- Character persona integration
- Interest and skill tags
- Social stats and connection info

### PeopleSearch
- Advanced filtering system
- Quick search suggestions
- Real-time search results
- Connection recommendations

## Customization 🎨

The design system uses CSS custom properties and can be easily customized:

- **Colors**: Gradient backgrounds with purple/blue theme
- **Typography**: Inter for UI, Playfair Display for headings
- **Effects**: Glassmorphism with backdrop-filter
- **Animations**: Framer Motion for smooth transitions

## Future Enhancements 🔮

- Real backend integration with user authentication
- Real-time messaging and notifications
- Advanced matching algorithms
- Mobile app version
- Video/voice chat integration
- Event planning and meetup features

## Contributing 🤝

Feel free to contribute to this project! Whether it's bug fixes, new features, or design improvements, all contributions are welcome.

---

Built with ❤️ for the modern social experience
