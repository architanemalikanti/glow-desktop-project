import React, { useState } from 'react';
import { Search, MapPin, Coffee, Briefcase, Heart, MessageCircle, Filter, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './PeopleSearch.css';

interface Person {
  id: string;
  name: string;
  persona: string;
  location: string;
  avatar: string;
  bio: string;
  interests: string[];
  skills: string[];
  currentStatus: string;
  canHelp: string[];
  lookingFor: string[];
  mutualConnections: number;
  lastActive: string;
}

const PeopleSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Mock data - in a real app, this would come from an API
  const people: Person[] = [
    {
      id: '1',
      name: 'Maya Patel',
      persona: 'Blair Waldorf',
      location: 'San Francisco, CA',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      bio: 'Product designer with a passion for sustainable fashion. Always down for spontaneous adventures! ✨',
      interests: ['Sustainable Fashion', 'UI/UX Design', 'Yoga', 'Coffee'],
      skills: ['Product Design', 'Figma', 'User Research'],
      currentStatus: 'Looking for roommates in Mission District',
      canHelp: ['Design feedback', 'SF housing tips', 'Sustainable living'],
      lookingFor: ['Roommates', 'Design mentorship', 'Hiking buddies'],
      mutualConnections: 12,
      lastActive: '2 hours ago'
    },
    {
      id: '2',
      name: 'Alex Chen',
      persona: 'Rory Gilmore',
      location: 'San Francisco, CA',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      bio: 'Software engineer by day, indie film enthusiast by night. Love connecting over books and coffee ☕',
      interests: ['Indie Films', 'Literature', 'Coffee Culture', 'Tech'],
      skills: ['Full Stack Development', 'React', 'Node.js'],
      currentStatus: 'Organizing a book club meetup',
      canHelp: ['Tech career advice', 'Code reviews', 'Film recommendations'],
      lookingFor: ['Book club members', 'Coffee shop recommendations', 'Film discussion partners'],
      mutualConnections: 8,
      lastActive: '1 hour ago'
    },
    {
      id: '3',
      name: 'Sophie Rodriguez',
      persona: 'Serena van der Woodsen',
      location: 'San Francisco, CA',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      bio: 'Marketing maven with wanderlust. Currently planning my next adventure while building my startup 🚀',
      interests: ['Travel', 'Marketing', 'Startups', 'Photography'],
      skills: ['Digital Marketing', 'Content Strategy', 'Brand Building'],
      currentStatus: 'Launching a travel app',
      canHelp: ['Marketing strategy', 'Travel planning', 'Startup advice'],
      lookingFor: ['Co-founders', 'Travel companions', 'Marketing collaborators'],
      mutualConnections: 15,
      lastActive: '30 minutes ago'
    },
    {
      id: '4',
      name: 'Jordan Kim',
      persona: 'Hermione Granger',
      location: 'San Francisco, CA',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      bio: 'Data scientist with a love for board games and good conversations. Always happy to help with analytics! 📊',
      interests: ['Data Science', 'Board Games', 'Machine Learning', 'Cooking'],
      skills: ['Python', 'Machine Learning', 'Data Analysis'],
      currentStatus: 'Hosting weekly game nights',
      canHelp: ['Data analysis', 'Python tutoring', 'Game recommendations'],
      lookingFor: ['Game night participants', 'Data science projects', 'Cooking partners'],
      mutualConnections: 6,
      lastActive: '4 hours ago'
    }
  ];

  const filterOptions = [
    'Looking for housing',
    'Can provide housing',
    'Hiring',
    'Looking for work',
    'Travel companions',
    'Creative collaborators',
    'Mentorship',
    'Coffee dates',
    'Same interests'
  ];

  const filteredPeople = people.filter(person => {
    const matchesSearch = searchQuery === '' || 
      person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.interests.some(interest => interest.toLowerCase().includes(searchQuery.toLowerCase())) ||
      person.canHelp.some(help => help.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilters = selectedFilters.length === 0 || 
      selectedFilters.some(filter => 
        person.canHelp.some(help => help.toLowerCase().includes(filter.toLowerCase())) ||
        person.lookingFor.some(looking => looking.toLowerCase().includes(filter.toLowerCase()))
      );

    return matchesSearch && matchesFilters;
  });

  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const quickSearches = [
    { text: 'Who can help with SF housing?', icon: <Coffee size={16} /> },
    { text: 'Looking for hiking buddies', icon: <Heart size={16} /> },
    { text: 'Anyone hiring designers?', icon: <Briefcase size={16} /> },
    { text: 'Coffee dates this week?', icon: <MessageCircle size={16} /> }
  ];

  return (
    <div className="search-container">
      <div className="search-header">
        <div className="header-content">
          <Sparkles className="header-icon" />
          <div>
            <h1>Discover Your Network</h1>
            <p>Find amazing people who share your vibe and can help with what you need ✨</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-bar">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search for people, interests, or what you need help with..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button 
            className="filter-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            Filters
          </button>
        </div>

        {/* Quick Searches */}
        <div className="quick-searches">
          <span className="quick-label">Quick searches:</span>
          {quickSearches.map((search, index) => (
            <button
              key={index}
              className="quick-search-btn"
              onClick={() => setSearchQuery(search.text)}
            >
              {search.icon}
              {search.text}
            </button>
          ))}
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="filters-section"
            >
              <div className="filters-grid">
                {filterOptions.map((filter) => (
                  <button
                    key={filter}
                    className={`filter-tag ${selectedFilters.includes(filter) ? 'active' : ''}`}
                    onClick={() => toggleFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <div className="results-section">
        <div className="results-header">
          <h2>
            {filteredPeople.length} people found
            {searchQuery && ` for "${searchQuery}"`}
          </h2>
        </div>

        <div className="people-grid">
          <AnimatePresence>
            {filteredPeople.map((person, index) => (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className="person-card"
              >
                <div className="person-header">
                  <div className="person-avatar">
                    <img src={person.avatar} alt={person.name} />
                  </div>
                  <div className="person-info">
                    <h3>{person.name}</h3>
                    <p className="persona">Written by {person.persona} ✨</p>
                    <div className="person-meta">
                      <span><MapPin size={14} /> {person.location}</span>
                      <span>{person.mutualConnections} mutual connections</span>
                    </div>
                  </div>
                </div>

                <div className="person-bio">
                  <p>{person.bio}</p>
                </div>

                <div className="person-status">
                  <span className="status-label">Currently:</span>
                  <span className="status-text">{person.currentStatus}</span>
                </div>

                <div className="person-section">
                  <h4>Can help with:</h4>
                  <div className="tags">
                    {person.canHelp.map((help, index) => (
                      <span key={index} className="tag help-tag">
                        {help}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="person-section">
                  <h4>Looking for:</h4>
                  <div className="tags">
                    {person.lookingFor.map((looking, index) => (
                      <span key={index} className="tag looking-tag">
                        {looking}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="person-interests">
                  <h4>Interests:</h4>
                  <div className="tags">
                    {person.interests.slice(0, 3).map((interest, index) => (
                      <span key={index} className="tag interest-tag">
                        {interest}
                      </span>
                    ))}
                    {person.interests.length > 3 && (
                      <span className="tag more-tag">+{person.interests.length - 3} more</span>
                    )}
                  </div>
                </div>

                <div className="person-actions">
                  <button className="action-btn primary">
                    <MessageCircle size={16} />
                    Connect
                  </button>
                  <button className="action-btn secondary">
                    View Profile
                  </button>
                </div>

                <div className="person-footer">
                  <span className="last-active">Active {person.lastActive}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>


    </div>
  );
};

export default PeopleSearch;
