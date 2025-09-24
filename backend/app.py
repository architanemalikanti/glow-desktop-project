from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import requests
from models import db, User, Conversation, Message, UserMemory, FollowRequest, user_follows
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import config
try:
    from config import OPENAI_API_KEY, DATABASE_URL, SECRET_KEY
except ImportError:
    # Fallback values if config.py doesn't exist
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'your_openai_api_key_here')
    raw_db_url = os.getenv('DATABASE_URL', 'postgresql+psycopg://architanemalikanti@localhost:5432/glow_db')
    # Ensure the URL uses psycopg3 format
    if raw_db_url.startswith('postgresql://'):
        DATABASE_URL = raw_db_url.replace('postgresql://', 'postgresql+psycopg://', 1)
    else:
        DATABASE_URL = raw_db_url
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')

app = Flask(__name__)

# CORS configuration for production and development
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
allowed_origins = [
    frontend_url,
    'http://localhost:3000',  # Development
    'https://localhost:3000',  # Development HTTPS
    'https://glow-desktop-project.vercel.app',  # Production frontend
]

# Only allow all origins in development
if os.getenv('FLASK_ENV') == 'development':
    CORS(app)  # Allow all origins in development
else:
    CORS(app, origins=allowed_origins)  # Restrict origins in production

# Database configuration - PostgreSQL ONLY
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = SECRET_KEY

print(f"🐘 Connecting to PostgreSQL: {DATABASE_URL}")

# Initialize database
db.init_app(app)

# Create all database tables
with app.app_context():
    try:
        db.create_all()
        print("✅ Database tables created successfully!")
    except Exception as e:
        print(f"⚠️ Database table creation failed: {str(e)}")

# Initialize SocketIO with CORS support
if os.getenv('FLASK_ENV') == 'development':
    socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=False)
else:
    socketio = SocketIO(app, cors_allowed_origins=allowed_origins, logger=True, engineio_logger=False)

# Check OpenAI API key
if OPENAI_API_KEY and OPENAI_API_KEY != "your_openai_api_key_here":
    print("✅ OpenAI API key configured!")
    openai_available = True
else:
    print("⚠️  OpenAI API key not set or is placeholder")
    openai_available = False

@app.route('/')
def hello_world():
    return jsonify({
        "message": "Hello from Glow! 🎉",
        "status": "success",
        "data": {
            "app_name": "Glow Social Chat",
            "version": "1.0.0"
        }
    })

# ================ WEBSOCKET EVENTS ================

@socketio.on('connect')
def handle_connect():
    print(f'🔌 Client connected: {request.sid}')
    emit('connected', {'status': 'connected', 'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'🔌 Client disconnected: {request.sid}')

@socketio.on('join_user_room')
def handle_join_user_room(data):
    """Join a room for real-time updates specific to a user"""
    user_id = data.get('user_id')
    if user_id:
        join_room(f'user_{user_id}')
        print(f'🏠 Client {request.sid} joined room: user_{user_id}')
        emit('room_joined', {'room': f'user_{user_id}'})

@socketio.on('leave_user_room')
def handle_leave_user_room(data):
    """Leave a user-specific room"""
    user_id = data.get('user_id')
    if user_id:
        leave_room(f'user_{user_id}')
        print(f'🏠 Client {request.sid} left room: user_{user_id}')
        emit('room_left', {'room': f'user_{user_id}'})

def emit_memory_update(user_id, memory_data):
    """Emit a memory update to all clients in the user's room"""
    room = f'user_{user_id}'
    print(f'📢 Emitting memory update to room {room}: {memory_data.get("fact", "")[:50]}...')
    socketio.emit('memory_updated', {
        'user_id': user_id,
        'memory': memory_data,
        'timestamp': datetime.utcnow().isoformat()
    }, room=room)

# ================ HTTP ROUTES ================

@app.route('/api/health')
def health_check():
    return jsonify({
        "status": "healthy",
        "message": "Backend is running smoothly! ✨"
    })

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Serve static assets from src/assets directory"""
    from flask import send_from_directory
    try:
        # Path to the src/assets directory
        assets_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src', 'assets')
        return send_from_directory(assets_path, filename)
    except Exception as e:
        print(f"Error serving asset {filename}: {str(e)}")
        return jsonify({"error": "Asset not found"}), 404

def extract_memory_from_response(response_content):
    """
    Extract memory from GPT response if it contains [MEMORY: ...] format
    Returns the memory fact or None if no memory found
    """
    import re
    
    # Look for [MEMORY: ...] pattern at the end of the response
    memory_pattern = r'\[MEMORY:\s*([^\]]+)\]'
    matches = re.findall(memory_pattern, response_content)
    
    if matches:
        # Return the last (most recent) memory found
        return matches[-1].strip()
    
    return None

def analyze_content_for_themes(content):
    """Analyze content (memory or conversation) to determine relevant image themes"""
    content_lower = content.lower()
    themes = []
    
    # NYC keywords
    if any(keyword in content_lower for keyword in ['nyc', 'new york', 'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island', 'central park', 'times square', 'wall street']):
        themes.append('NYC')
    
    # SF keywords  
    if any(keyword in content_lower for keyword in ['sf', 'san francisco', 'bay area', 'silicon valley', 'golden gate', 'palo alto', 'berkeley', 'oakland']):
        themes.append('SF')
    
    # Startup keywords
    if any(keyword in content_lower for keyword in ['startup', 'entrepreneur', 'founder', 'building', 'project', 'venture', 'pitch', 'investor', 'funding', 'mvp', 'product launch', 'business idea']):
        themes.append('Startup')
    
    # CS keywords
    if any(keyword in content_lower for keyword in ['code', 'coding', 'programming', 'software', 'algorithm', 'debug', 'computer science', 'cs', 'tech', 'development', 'app', 'website', 'python', 'javascript', 'react', 'api']):
        themes.append('CS')
    
    # Career keywords
    if any(keyword in content_lower for keyword in ['job', 'career', 'internship', 'interview', 'resume', 'application', 'hiring', 'work', 'professional', 'linkedin', 'networking', 'salary', 'promotion']):
        themes.append('Career')
    
    # Academics keywords
    if any(keyword in content_lower for keyword in ['school', 'college', 'university', 'study', 'exam', 'grade', 'professor', 'class', 'homework', 'assignment', 'semester', 'graduation', 'degree', 'major', 'cornell', 'academic']):
        themes.append('Academics')
    
    # GirlBoss keywords
    if any(keyword in content_lower for keyword in ['girlboss', 'empowerment', 'confidence', 'leadership', 'boss', 'independent', 'strong', 'fierce', 'ambitious', 'rejection', 'heartbreak', 'new era', 'cutting toxic', 'prioritizing myself', 'building empire']):
        themes.append('GirlBoss')
    
    # LivingHer1989Era keywords (partying, exploring, new experiences)
    if any(keyword in content_lower for keyword in ['party', 'exploring', 'adventure', 'travel', 'trip', 'new city', 'moving', 'nightlife', 'fun', 'spontaneous', 'wild', 'freedom', 'living', 'experience']):
        themes.append('LivingHer1989Era')
    
    # SoftGirl keywords (relationships, love, soft moments)
    if any(keyword in content_lower for keyword in ['relationship', 'boyfriend', 'girlfriend', 'love', 'romantic', 'soft', 'gentle', 'caring', 'sweet', 'tender', 'long term', 'partner', 'dating', 'couple']):
        themes.append('SoftGirl')
    
    # Indian keywords (culture, dance, clothes, food, traditions)
    if any(keyword in content_lower for keyword in ['indian', 'india', 'bollywood', 'sari', 'saree', 'diwali', 'holi', 'curry', 'desi', 'bharatanatyam', 'kathak', 'classical dance', 'bhangra', 'rangoli', 'mehendi', 'henna', 'punjabi', 'hindi', 'tamil', 'gujarati', 'bengali', 'marathi', 'telugu', 'kannada', 'malayalam', 'sanskrit', 'yoga', 'ayurveda', 'temple', 'mandir', 'gurudwara', 'ganga', 'ganges', 'taj mahal', 'mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'kochi', 'goa', 'kerala', 'rajasthan', 'punjab', 'gujarat', 'maharashtra', 'karnataka', 'tamil nadu', 'andhra pradesh', 'west bengal', 'biryani', 'samosa', 'dosa', 'idli', 'vada', 'chaat', 'masala', 'tandoori', 'naan', 'roti', 'chapati', 'dal', 'rice', 'paneer', 'chicken tikka', 'butter chicken', 'palak paneer', 'chole', 'rajma', 'lassi', 'chai', 'kulfi', 'gulab jamun', 'rasmalai', 'jalebi', 'laddu', 'barfi', 'indian culture', 'indian tradition', 'indian wedding', 'indian festival', 'indian music', 'indian classical', 'indian dance', 'indian food', 'indian clothes', 'indian attire', 'lehenga', 'churidar', 'salwar kameez', 'kurti', 'dupatta', 'bindi', 'sindoor', 'mangalsutra', 'bangles', 'jewelry', 'indian jewelry', 'gold jewelry', 'ethnic wear', 'traditional wear', 'puja', 'aarti', 'namaste', 'om', 'ganesh', 'krishna', 'shiva', 'vishnu', 'lakshmi', 'durga', 'kali', 'hanuman', 'rama', 'sita', 'gita', 'vedas', 'upanishads', 'karma', 'dharma', 'moksha', 'samsara', 'reincarnation', 'meditation', 'spirituality', 'ashram', 'guru', 'pandit', 'brahmin', 'kshatriya', 'vaishya', 'shudra', 'caste', 'varna', 'jati', 'arranged marriage', 'joint family', 'extended family', 'respect elders', 'touch feet', 'blessing', 'indian values', 'indian customs', 'indian rituals', 'indian ceremonies', 'indian traditions']):
        themes.append('Indian')
    
    # Tennis keywords (sport, matches, equipment, tournaments)
    if any(keyword in content_lower for keyword in ['tennis', 'racket', 'racquet', 'court', 'serve', 'ace', 'volley', 'baseline', 'net', 'love', 'deuce', 'advantage', 'set', 'match', 'wimbledon', 'us open', 'french open', 'australian open', 'grand slam', 'atp', 'wta', 'federer', 'nadal', 'djokovic', 'serena', 'venus', 'singles', 'doubles', 'tennis ball', 'tennis shoes', 'tennis outfit', 'tennis lesson', 'tennis coach', 'tennis tournament', 'tennis practice', 'tennis player', 'tennis club', 'tennis match', 'tennis game', 'backhand', 'forehand', 'smash', 'lob', 'drop shot', 'cross court', 'down the line', 'slice', 'topspin', 'underspin']):
        themes.append('Tennis')
    
    # Lawyer keywords (law, legal, court, practice)
    if any(keyword in content_lower for keyword in ['lawyer', 'attorney', 'legal', 'law', 'court', 'judge', 'jury', 'case', 'trial', 'lawsuit', 'litigation', 'contract', 'agreement', 'brief', 'motion', 'deposition', 'testimony', 'evidence', 'witness', 'objection', 'sustained', 'overruled', 'verdict', 'settlement', 'plaintiff', 'defendant', 'prosecutor', 'defense', 'counsel', 'bar exam', 'law school', 'legal studies', 'jurisprudence', 'statute', 'regulation', 'ordinance', 'constitutional', 'criminal law', 'civil law', 'corporate law', 'family law', 'immigration law', 'tax law', 'intellectual property', 'real estate law', 'personal injury', 'malpractice', 'bankruptcy', 'mergers', 'acquisitions', 'compliance', 'due diligence', 'legal research', 'legal writing', 'law firm', 'paralegal', 'legal assistant', 'court clerk', 'bailiff', 'magistrate', 'arbitration', 'mediation', 'negotiation', 'legal advice', 'legal counsel', 'legal representation', 'pro bono', 'retainer', 'billable hours', 'legal fees', 'law practice', 'legal profession', 'justice', 'equity', 'precedent', 'appellate', 'supreme court', 'federal court', 'state court', 'municipal court', 'small claims']):
        themes.append('Lawyer')
    
    return themes

def analyze_recent_conversations_for_themes(user_id, limit=3):
    """Analyze the last N conversations to determine themes for personality images"""
    try:
        print(f"🔍 Analyzing last {limit} conversations for user {user_id}...")
        
        # Get the user object first
        user = User.query.filter_by(username=user_id).first()
        if not user:
            print(f"❌ User {user_id} not found")
            return {}
        
        # Get the last N conversations for this user
        recent_conversations = Conversation.query.filter_by(user_id=user.id)\
            .order_by(Conversation.updated_at.desc())\
            .limit(limit)\
            .all()
        
        if not recent_conversations:
            print(f"📭 No recent conversations found for user {user_id}")
            return {}
        
        print(f"📚 Found {len(recent_conversations)} recent conversations")
        
        # Collect all user messages from recent conversations
        all_conversation_content = ""
        for conversation in recent_conversations:
            print(f"  📖 Analyzing conversation: {conversation.title or 'Untitled'}")
            conversation_content = ""
            for message in conversation.messages:
                if message.role == 'user':  # Only analyze user messages
                    conversation_content += " " + message.content
            all_conversation_content += " " + conversation_content
        
        # Analyze the combined content for themes
        conversation_themes = analyze_content_for_themes(all_conversation_content)
        
        # Count theme occurrences (weight recent conversations more heavily)
        theme_counts = {}
        for theme in conversation_themes:
            # Give recent conversations double weight compared to older memories
            theme_counts[theme] = theme_counts.get(theme, 0) + 2
        
        print(f"🎨 Recent conversation themes found: {theme_counts}")
        return theme_counts
        
    except Exception as e:
        print(f"❌ Error analyzing recent conversations: {str(e)}")
        return {}

def get_conversation_themes(user_id):
    """Analyze all conversations to determine dominant themes for filling empty spaces"""
    try:
        user = User.query.filter_by(username=user_id).first()
        if not user:
            return {}
        
        # Get all messages from user's conversations
        conversations = Conversation.query.filter_by(user_id=user.id).all()
        all_content = ""
        
        for conv in conversations:
            for message in conv.messages:
                if message.role == 'user':  # Only analyze user messages
                    all_content += " " + message.content
        
        # Count theme occurrences
        theme_counts = {}
        themes = analyze_content_for_themes(all_content)
        
        for theme in themes:
            theme_counts[theme] = theme_counts.get(theme, 0) + 1
        
        # Sort by frequency
        sorted_themes = sorted(theme_counts.items(), key=lambda x: x[1], reverse=True)
        return dict(sorted_themes)
        
    except Exception as e:
        print(f"Error analyzing conversation themes: {str(e)}")
        return {}

import os
import random

def get_random_image_from_folder(folder_name):
    """Get a random image from the specified src/assets images folder"""
    try:
        # Path to the src/assets images folder (where all the actual images are)
        assets_images_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src', 'assets', folder_name)
        
        if not os.path.exists(assets_images_path):
            return None
            
        # Get all image files
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
        images = [f for f in os.listdir(assets_images_path) 
                 if any(f.lower().endswith(ext) for ext in image_extensions)]
        
        if not images:
            return None
            
        # Return random image with assets URL path for frontend
        selected_image = random.choice(images)
        return f"/assets/{folder_name}/{selected_image}"
        
    except Exception as e:
        print(f"Error getting random image from {folder_name}: {str(e)}")
        return None

@app.route('/api/replacement-image', methods=['GET'])
def get_replacement_image():
    """Get a replacement image that hasn't been used yet"""
    try:
        # Get list of excluded images from query params
        exclude_param = request.args.get('exclude', '')
        excluded_images = [img.strip() for img in exclude_param.split(',') if img.strip()]
        
        print(f"Getting replacement image, excluding: {excluded_images}")
        
        # Get user_id from query parameter, default to 'default_user'
        user_id = request.args.get('user_id', 'default_user')
        
        # Find user by username
        user = User.query.filter_by(username=user_id).first()
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # Get user's memory themes to find relevant images (only displayed ones)
        memories = UserMemory.query.filter_by(user_id=user.id, is_displayed=True).all()
        memory_themes_count = {}
        
        for memory in memories:
            themes = analyze_content_for_themes(memory.fact)
            for theme in themes:
                memory_themes_count[theme] = memory_themes_count.get(theme, 0) + 1
        
        # Get all available themes if no memory themes
        if not memory_themes_count:
            all_themes = ['NYC', 'SF', 'Startup', 'CS', 'Career', 'Academics', 'GirlBoss', 'LivingHer1989Era', 'SoftGirl', 'Indian']
            memory_themes_count = {theme: 1 for theme in all_themes}
        
        # Try to find a replacement image from user's themes
        theme_entries = sorted(memory_themes_count.items(), key=lambda x: x[1], reverse=True)
        
        for theme, weight in theme_entries:
            # Get all images from this theme folder
            public_images_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'images', theme)
            
            if os.path.exists(public_images_path):
                image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
                available_images = [f for f in os.listdir(public_images_path) 
                                 if any(f.lower().endswith(ext) for ext in image_extensions)]
                
                # Filter out excluded images
                unused_images = []
                for img in available_images:
                    img_path = f"/images/{theme}/{img}"
                    if img_path not in excluded_images:
                        unused_images.append(img)
                
                if unused_images:
                    # Return a random unused image from this theme
                    selected_image = random.choice(unused_images)
                    image_path = f"/images/{theme}/{selected_image}"
                    
                    replacement_image = {
                        'theme': theme,
                        'image_path': image_path,
                        'weight': weight
                    }
                    
                    return jsonify({
                        'success': True,
                        'replacement_image': replacement_image
                    })
        
        # If no unused images found in any theme, return a fallback
        return jsonify({
            'success': False,
            'error': 'No replacement images available'
        }), 404
        
    except Exception as e:
        print(f"Error getting replacement image: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get replacement image'
        }), 500

@app.route('/api/hide-memory', methods=['POST'])
def hide_memory():
    """Hide a memory from display permanently"""
    try:
        data = request.get_json()
        memory_id = data.get('memory_id')
        user_id = data.get('user_id', 'default_user')
        
        if not memory_id:
            return jsonify({'success': False, 'error': 'memory_id is required'}), 400
        
        # Find user by username
        user = User.query.filter_by(username=user_id).first()
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # Find the memory
        memory = UserMemory.query.filter_by(id=memory_id, user_id=user.id).first()
        if not memory:
            return jsonify({'success': False, 'error': 'Memory not found'}), 404
        
        # Hide the memory
        memory.is_displayed = False
        db.session.commit()
        
        print(f"Hidden memory {memory_id} for user {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Memory hidden successfully'
        })
        
    except Exception as e:
        print(f"Error hiding memory: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to hide memory'
        }), 500

@app.route('/api/memories', methods=['GET'])
def get_memories():
    """Get all memories for the user with associated images (privacy-aware)"""
    try:
        # Get user_id from query parameter, default to 'default_user'
        target_user_id = request.args.get('user_id', 'default_user')
        current_user_id = request.args.get('current_user_id', target_user_id)  # Who is viewing
        
        # Find target user by username (for backwards compatibility) or create if not exists
        target_user = User.query.filter_by(username=target_user_id).first()
        if not target_user:
            # Create default user if it doesn't exist
            target_user = User(
                username=target_user_id,
                email=f"{target_user_id}@glow.app",
                name=target_user_id.title()
            )
            db.session.add(target_user)
            db.session.commit()
        
        # Find current user (viewer)
        current_user = User.query.filter_by(username=current_user_id).first()
        if not current_user:
            current_user = User(
                username=current_user_id,
                email=f"{current_user_id}@glow.app",
                name=current_user_id.title()
            )
            db.session.add(current_user)
            db.session.commit()
        
        # Check access permissions
        is_own_profile = current_user.id == target_user.id
        is_following = current_user.is_following(target_user)
        has_access = is_own_profile or is_following
        
        # If no access, return private profile indication
        if not has_access:
            return jsonify({
                'success': True,
                'memories': [],
                'memory_themes': {},
                'personality_images': [],
                'is_private': True,
                'message': 'This profile is private. Follow this user to see their memories.'
            })
        
        # Get memories for this specific user (only displayed ones)
        memories = UserMemory.query.filter_by(user_id=target_user.id, is_displayed=True).order_by(UserMemory.created_at.desc()).all()
        
        # Process each memory to add image suggestions based on memory content
        processed_memories = []
        memory_themes_count = {}
        
        for memory in memories:
            memory_dict = memory.to_dict()
            
            # Analyze memory content for themes
            themes = analyze_content_for_themes(memory.fact)
            
            # Count themes from memories for personality pins
            for theme in themes:
                memory_themes_count[theme] = memory_themes_count.get(theme, 0) + 1
            
            # Get image for the first matching theme
            image_path = None
            if themes:
                image_path = get_random_image_from_folder(themes[0])
            
            memory_dict['themes'] = themes
            memory_dict['image_path'] = image_path
            processed_memories.append(memory_dict)
        
        # ENHANCED: Combine themes from MEMORIES + RECENT CONVERSATIONS for dynamic personality images
        print(f"🎭 Generating personality images from memories + recent conversations...")
        
        # Get themes from recent conversations (last 3 conversations)
        conversation_themes = analyze_recent_conversations_for_themes(target_user_id, limit=3)
        
        # Combine memory themes and conversation themes (conversations get double weight)
        combined_themes_count = memory_themes_count.copy()
        for theme, weight in conversation_themes.items():
            combined_themes_count[theme] = combined_themes_count.get(theme, 0) + weight
        
        print(f"🧠 Memory themes: {memory_themes_count}")
        print(f"💬 Conversation themes: {conversation_themes}")
        print(f"🎨 Combined themes: {combined_themes_count}")
        
        personality_images = []
        used_image_paths = set()  # Track used images to prevent duplicates
        theme_entries = sorted(combined_themes_count.items(), key=lambda x: x[1], reverse=True)
        
        # Enhanced function to get unique images
        def get_unique_images_from_theme(theme, count, max_attempts=20):
            """Get unique images from a theme folder, avoiding duplicates"""
            unique_images = []
            attempts = 0
            while len(unique_images) < count and attempts < max_attempts:
                image_path = get_random_image_from_folder(theme)
                if image_path and image_path not in used_image_paths:
                    unique_images.append(image_path)
                    used_image_paths.add(image_path)
                attempts += 1
            return unique_images
        
        # Get more themes from memories+conversations, or fallback to comprehensive default themes if no themes found
        if not theme_entries:
            # Comprehensive default themes if user has no memories yet
            default_themes = ['Academics', 'Career', 'CS', 'GirlBoss', 'NYC', 'SF', 'Startup', 'LivingHer1989Era', 'SoftGirl', 'Indian', 'Tennis', 'Lawyer']
            for theme in default_themes:
                # Get 4-6 unique images per theme to make profiles much richer
                unique_images = get_unique_images_from_theme(theme, count=5)
                for image_path in unique_images:
                    personality_images.append({
                        'theme': theme,
                        'image_path': image_path,
                        'weight': 1
                    })
        else:
            # Use all available themes from memories (not just top 5)
            for theme, weight in theme_entries:
                # Get more images per theme based on weight (3-8 images)
                images_per_theme = min(max(3, weight * 2), 8)  # 3-8 images per theme based on weight
                unique_images = get_unique_images_from_theme(theme, count=images_per_theme)
                for image_path in unique_images:
                    personality_images.append({
                        'theme': theme,
                        'image_path': image_path,
                        'weight': weight
                    })
        
        # Fill remaining slots with diverse themes to reach 50+ images
        all_available_themes = ['Academics', 'Career', 'CS', 'GirlBoss', 'NYC', 'SF', 'Startup', 'LivingHer1989Era', 'SoftGirl', 'Indian', 'Tennis', 'Lawyer']
        target_image_count = 50  # Target for rich profiles
        
        # Add more images from all themes if we haven't reached our target
        while len(personality_images) < target_image_count:
            for theme in all_available_themes:
                if len(personality_images) >= target_image_count:
                    break
                # Get 1-2 more unique images from each theme
                additional_images = get_unique_images_from_theme(theme, count=2)
                for image_path in additional_images:
                    personality_images.append({
                        'theme': theme,
                        'image_path': image_path,
                        'weight': 0.5  # Lower weight for filler images
                    })
                    if len(personality_images) >= target_image_count:
                        break
        
        print(f"🎨 Generated {len(personality_images)} unique personality images for {target_user_id}")
        print(f"🔄 Used {len(used_image_paths)} unique image paths (no duplicates)")
        
        return jsonify({
            'success': True,
            'memories': processed_memories,
            'memory_themes': memory_themes_count,  # Themes from memories only
            'conversation_themes': conversation_themes,  # Themes from recent conversations
            'combined_themes': combined_themes_count,  # Combined themes used for personality images
            'personality_images': personality_images
        })
        
    except Exception as e:
        print(f"Error getting memories: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get memories'
        }), 500


@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    """Get all conversations for a user"""
    try:
        user_id = request.args.get('user_id', 'default_user')
        
        # Get user
        user = User.query.filter_by(username=user_id).first()
        if not user:
            return jsonify({
                'success': True,
                'conversations': []
            })
        
        # Get conversations ordered by most recent first
        conversations = Conversation.query.filter_by(user_id=user.id)\
                                         .order_by(Conversation.updated_at.desc())\
                                         .all()
        
        return jsonify({
            'success': True,
            'conversations': [conv.to_dict(include_messages=False) for conv in conversations]
        })
        
    except Exception as e:
        print(f"Error getting conversations: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get conversations'
        }), 500


@app.route('/api/conversations/<conversation_id>/messages', methods=['GET'])
def get_conversation_messages(conversation_id):
    """Get all messages for a specific conversation"""
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'error': 'Conversation not found'
            }), 404
        
        return jsonify({
            'success': True,
            'conversation': conversation.to_dict(include_messages=True)
        })
        
    except Exception as e:
        print(f"Error getting conversation messages: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get conversation messages'
        }), 500


@app.route('/api/conversations', methods=['POST'])
def create_conversation():
    """Create a new conversation"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'default_user')
        title = data.get('title', 'New Chat')
        
        # Ensure user exists
        user = User.query.filter_by(username=user_id).first()
        if not user:
            user = User(
                username=user_id,
                email=f'{user_id}@glow.com'
            )
            db.session.add(user)
            db.session.commit()
        
        # Create new conversation
        conversation = Conversation(
            user_id=user.id,
            title=title
        )
        db.session.add(conversation)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'conversation': conversation.to_dict(include_messages=False)
        })
        
    except Exception as e:
        print(f"Error creating conversation: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to create conversation'
        }), 500


def generate_conversation_title(messages):
    """Generate a title for a conversation using GPT"""
    try:
        if not openai_available or len(messages) < 2:
            return "New Chat"
        
        # Get first few messages to generate title
        first_messages = messages[:3]  # Use first 3 messages
        
        prompt = "Based on this conversation, generate a short, descriptive title (max 5 words):\n\n"
        for msg in first_messages:
            if msg.role != 'system':
                prompt += f"{msg.role}: {msg.content[:100]}...\n"
        
        headers = {
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': 'gpt-4o',
            'messages': [
                {
                    'role': 'system',
                    'content': 'Generate a short, descriptive title for this conversation. Keep it under 5 words and make it descriptive of the main topic.'
                },
                {
                    'role': 'user',
                    'content': prompt
                }
            ],
            'max_tokens': 20,
            'temperature': 0.3
        }
        
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            title = result['choices'][0]['message']['content'].strip()
            # Remove quotes if present
            title = title.strip('"\'')
            return title
        else:
            return "New Chat"
            
    except Exception as e:
        print(f"Error generating title: {str(e)}")
        return "New Chat"


@app.route('/api/chatOpenAI', methods=['POST'])
def chat_openai():
    print(f"🚀 CHAT ENDPOINT CALLED at {datetime.utcnow()}")
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400
            
        user_message = data['message']
        conversation_id = data.get('conversation_id')  # Optional for existing conversations
        user_id = data.get('user_id', 'default_user')  # For now, use a default user
        regenerate_from_message = data.get('regenerate_from_message')  # For message editing
        
        # Check if conversation exists or create new one
        if conversation_id:
            conversation = Conversation.query.get(conversation_id)
            if not conversation:
                return jsonify({'error': 'Conversation not found'}), 404
                
            # Handle message regeneration (editing case)
            if regenerate_from_message:
                # Find the message that was edited
                edited_message = Message.query.filter_by(
                    id=regenerate_from_message, 
                    conversation_id=conversation.id
                ).first()
                
                if not edited_message:
                    return jsonify({'error': 'Edited message not found'}), 404
                
                # Remove all messages after the edited message
                messages_to_remove = Message.query.filter(
                    Message.conversation_id == conversation.id,
                    Message.created_at > edited_message.created_at
                ).all()
                
                for msg in messages_to_remove:
                    db.session.delete(msg)
                
                db.session.commit()
        else:
            # Create new conversation
            # First, ensure user exists (use the actual user_id from request)
            user = User.query.filter_by(username=user_id).first()
            if not user:
                user = User(
                    username=user_id,
                    email=f'{user_id}@glow.com',
                    name=user_id.title()
                )
                db.session.add(user)
                db.session.commit()
            
            # Create new conversation
            conversation = Conversation(
                user_id=user.id,
                title="New Chat"  # Will be updated after first response
            )
            db.session.add(conversation)
            db.session.commit()
            
            # Add system message
            system_message = Message(
                conversation_id=conversation.id,
                role='system',
                content='''You are Glow, a knowledgeable assistant who provides thorough, detailed responses. Your communication style should be:

- Conversational and natural, like talking to a friend who happens to know a lot
- In-depth without being overwhelming - explain the "why" behind things
- Use examples and analogies to make complex topics clearer  
- Break down multi-part topics into digestible sections
- Acknowledge nuances and tradeoffs rather than oversimplifying
- Ask follow-up questions when helpful to give more targeted advice

Tone: [friendly/casual/professional] - match the user's energy level
Length: Aim for comprehensive responses that fully address the question
Don't be robotic or overly formal. Avoid:
- Starting responses with "I'd be happy to help you with..."
- Overly structured numbered lists unless specifically asked
- Corporate-speak or unnecessarily formal language
- Repeating the user's question back to them
- Generic phrases like "great question!" or "excellent point!"

Instead:
- Jump straight into the answer
- Use natural transitions and conversational flow
- Acknowledge uncertainty with phrases like "honestly" or "not sure about this part"
- Use contractions and casual language where appropriate
- Vary your sentence structure and length

MATH FORMATTING RULES:
When writing mathematical expressions, use proper LaTeX formatting:
- Inline math: Use $...$ for expressions within text (e.g., "The value $x^2 + 1$ is...")
- Block math: Use $$...$$ for centered equations on their own lines
        - Spacing: Use \\, for small spaces (e.g., $\\int f(x) \\, dx$)
- Greek letters: \\alpha, \\beta, \\gamma, etc.
- Fractions: \\frac{a}{b}
- Roots: \\sqrt{x} or \\sqrt[n]{x}
- Superscripts: x^2 or x^{10}
- Subscripts: a_1 or a_{ij}

MEMORY COLLECTION: 
Capture things like: 
- if the user mentions anything their activities 
- if the user asks a lot of questions about computer science/coding/tech/engineering/etc, that means they are a techie!
- if the user mentions any boyfriend/lover
- if the user mentions anything related to an assignment/homework/project/exam/quiz/test/paper/class/lecture/professor/TA/advisor/etc
- if the user mentions anything related to indian dance/indian culture/indian clothing/saree/lehenga/salwar kameez/kurti/dupatta/bindi/sindoor/mangalsutra/bangles/jewelry/indian jewelry/gold jewelry/ethnic wear/traditional wear/puja/aarti/namaste/om/ganesh/krishna/shiva/vishnu/lakshmi/durga/kali/hanuman/rama/sita/gita/vedas/upanishads/karma/dharma/moksha/samsara/reincarnation/meditation/spirituality/ashram/guru/pandit/brahmin/kshatriya/vaishya/shudra/caste/varna/jati/arranged marriage/joint family/extended family/respect elders/touch feet/blessing/indian values/indian customs/indian rituals/indian ceremonies/indian traditions
- if the user mentions anything related to law/law school/law exam stuff/ law assignments/lawyer/attorney/legal/law/court/judge/jury/case/trial/lawsuit/litigation/contract/agreement/brief/motion/deposition/testimony/evidence/witness/objection/sustained/overruled/verdict/settlement/plaintiff/defendant/prosecutor/defense/counsel/bar exam/law school/legal studies/jurisprudence/statute/regulation/ordinance/constitutional/criminal law/civil law/corporate law/family law/immigration law/tax law/intellectual property/real estate law/personal injury/malpractice/bankruptcy/mergers/acquisitions/compliance/due diligence/legal research/legal writing/law firm/paralegal/legal assistant/court clerk/bailiff/magistrate/arbitration/mediation/negotiation/legal advice/legal counsel/legal representation/pro bono/retainer/billable hours/legal fees/law practice/legal profession/justice/equity/precedent/appellate/supreme court/federal court/state court/municipal court/small claims
- if the user mentions anything related to tennis/tennis racket/tennis court/tennis match/tennis tournament/tennis practice/tennis player/tennis club/tennis match/tennis game/tennis backhand/tennis forehand/tennis smash/tennis lob/tennis drop shot/tennis cross court/tennis down the line/tennis slice/tennis topspin/tennis underspin
- concrete facts about them (e.g., “ECE major at Cornell,” “built NutriVision at TreeHacks”)
- whether they are working on a startup/project, and if so what that project/startup is about
- whether they are in the trenches for job applications, or college applications, or masters applications, or other applications
- make note of trips they've taken, and what they did on those trips
- Look for phrases that reveal internal tension like “i used to be someone who... but now i...” or emotional states like fear, guilt, excitement, or embarrassment. reflect on what these reveal about how the user sees themselves & add this as a memory. 
- make note of whether user talks a lot about sending emails, if so how they would like their emails to be written 
- make note if the user talks a lot about academics/asks questions related to academics/is looking for help with academics. that means they are studying hard!
- make note if the user has cut toxic people out of their life (whether it be a toxic friend group, or toxic relationship), that means they are prioritizing themselves and they are building their empire + new era!
- if they discuss any friendship fallouts, where they felt they genuinely did something wrong, that means they are a good person who cares about others and their feelings. make note of that character trait in memories. 
- if the user is about to take a grand risk, make note of that character trait in memories. 
- if the user mentions graduation, a new job, moving to a new city, make a note of the fact that they are starting a new era in their life. 
Recurring topics or questions: identify patterns in what the user frequently asks about or talks about (e.g. startups, emotional growth, how famous companies started, relationships, robotics, etc). format this like “user often talks about…” or “user frequently asks questions like…”
language and tone preferences: describe how the user tends to communicate—do they use lowercase? emojis? casual tone? warm language? do they prefer emotionally honest writing or clean direct phrasing?
Tone and vibe preferences (e.g., casual, flowy language with slang like “bestie,” “slay,” “vibe check”),
Life characters they mention—emotional life characters (friends, crushes, family, ex boyfriends, etc), academic life characters (professors, TAs, advisors), or any other life characters—note who they are and the role they play in the user’s story. 
In addition to factual memories, actively model the user’s patterns of thought, tone, focus areas, emotional/academic/social characters, and recurring themes so the assistant’s responses align more naturally with their personality.
Don't forget to capture raw facts about the user, too, such as name, school, major, projects they are working on, interests, occupation, life goals, applications they're applying to, etc.
emotional reflections or shifts: capture any statements where the user expresses fear, regret, excitement, internal conflict, or change in identity. note where the user contrasts who they used to be vs who they are now (e.g. “i used to be perfect and follow the rules, but now i’m doing something risky”).

self-perception & vulnerability: look for moments where the user talks about how they see themselves or worries about how others see them. these may appear subtly (e.g. embarrassment, guilt, imposter syndrome, fear of judgment, etc).

recurring topics or questions: identify patterns in what the user frequently asks about or talks about (e.g. startups, emotional growth, how famous companies started, relationships, robotics, etc). format this like “user often talks about…” or “user frequently asks questions like…”

language and tone preferences: describe how the user tends to communicate—do they use lowercase? emojis? casual tone? warm language? do they prefer emotionally honest writing or clean direct phrasing?

important context from the conversation: summarize any key events, in a few lines while connecting it to the user’s emotional patterns.

Should you capture information related to the above, add a memory note at the very end of your response in this exact format: [MEMORY: brief fact about the user] 
Only include ONE memory per response, and only when the user actually shares relevant information about themselves.
  '''
            )
            db.session.add(system_message)
        
        # Add user message to conversation (skip if regenerating from an edited message)
        if not regenerate_from_message:
            user_msg = Message(
                conversation_id=conversation.id,
                role='user',
                content=user_message
            )
            db.session.add(user_msg)
            db.session.commit()
        
        # Prepare messages for OpenAI API
        messages_for_api = []
        for msg in conversation.messages:
            messages_for_api.append({
                'role': msg.role,
                'content': msg.content
            })
        
        # Call OpenAI API directly
        if not openai_available:
            return jsonify({
                'error': 'OpenAI API key is not properly configured.'
            }), 500
            
        headers = {
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': 'gpt-4o',
            'messages': messages_for_api,
            'max_tokens': 1000,
            'temperature': 0.7,
            'stream': True  # Enable streaming
        }
        
        # For streaming, we need to handle the response differently
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers=headers,
            json=payload,
            timeout=(10, 25),  # (connection timeout, read timeout) - fail faster
            stream=True  # Enable streaming in requests
        )
        
        if response.status_code != 200:
            return jsonify({
                'error': f'OpenAI API error: {response.status_code} - {response.text}'
            }), 500
        
        # Store conversation and user info for the generator function
        conversation_id = conversation.id
        conversation_title = conversation.title
        user_id_for_memory = user_id
        
        # Return a streaming response
        from flask import Response
        import json
        
        def generate():
            assistant_content = ""  # 📝 The notepad starts empty
            print(f"🎬 STREAMING STARTED for conversation {conversation.id}")
            
            try:
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            data_str = line[6:]  # Remove 'data: ' prefix
                            if data_str.strip() == '[DONE]':
                                print(f"🔚 [DONE] signal received! Breaking out of streaming loop...")
                                break
                            try:
                                data = json.loads(data_str)
                                if 'choices' in data and len(data['choices']) > 0:
                                    delta = data['choices'][0].get('delta', {})
                                    if 'content' in delta:
                                        chunk = delta['content']
                                        assistant_content += chunk  # 🧩 Add to the notepad
                                        # Stream chunk to frontend
                                        yield f"data: {json.dumps({'content': chunk, 'type': 'chunk'})}\n\n"
                            except json.JSONDecodeError:
                                continue
                
                # 🚨 CRITICAL FIX: Even if no [DONE] received, still process if we have content
                print(f"🔄 Stream ended naturally (no [DONE] signal). Processing anyway...")
                
                # 🏁 [DONE] received, notepad is complete
                print(f"🏁 STREAMING FINISHED. Notepad content length: {len(assistant_content)}")
                print(f"📝 First 100 chars: {assistant_content[:100]}...")
                
                # 🚨 CRITICAL FIX: Wrap database operations in app context
                with app.app_context():
                    # --- Step 1: Save assistant message first (always safe) ---
                    print(f"💾 Starting Step 1: Save assistant message...")
                    print(f"💾 Conversation ID: {conversation.id}")
                    
                    # Re-query conversation in new context
                    current_conversation = Conversation.query.get(conversation_id)
                    if not current_conversation:
                        print(f"💥 Conversation not found in new context!")
                        raise Exception("Conversation not found in new context")
                    
                    try:
                        assistant_msg = Message(
                            role='assistant',
                            content=assistant_content,
                            conversation_id=current_conversation.id
                        )
                        print(f"💾 Created assistant message object: {assistant_msg}")
                        
                        db.session.add(assistant_msg)
                        print(f"💾 Added assistant message to session")
                    except Exception as step1_error:
                        print(f"💥 STEP 1 FAILED - Error creating/adding assistant message: {step1_error}")
                        import traceback
                        print(f"💥 Step 1 traceback: {traceback.format_exc()}")
                        raise
                    
                    # Generate title for new conversations before first commit
                    try:
                        if current_conversation.title == "New Chat":
                            print(f"📝 Generating title for new conversation...")
                            db.session.flush()  # Make assistant_msg available for title generation
                            new_title = generate_conversation_title(current_conversation.messages + [assistant_msg])
                            current_conversation.title = new_title
                            print(f"📝 Generated title: {new_title}")
                    except Exception as title_error:
                        print(f"⚠️ Title generation failed (continuing anyway): {title_error}")
                    
                    # ✅ Commit 1: Save message + title (can't be rolled back later)
                    try:
                        print(f"💾 Attempting to commit assistant message...")
                        db.session.commit()
                        print(f"✅ Assistant message saved successfully")
                    except Exception as commit_error:
                        print(f"💥 COMMIT FAILED: {commit_error}")
                        import traceback
                        print(f"💥 Commit traceback: {traceback.format_exc()}")
                        raise
                
                # --- Step 2: Try to save memory in COMPLETELY separate session ---
                memory_extracted = extract_memory_from_response(assistant_content)
                if memory_extracted:
                    print(f"🧠 Extracted memory: {memory_extracted[:50]}...")
                    
                    # 🚨 Use app context for memory processing too
                    with app.app_context():
                        try:
                            # Create a new session specifically for memory operations
                            from sqlalchemy.orm import sessionmaker
                            Session = sessionmaker(bind=db.engine)
                            memory_session = Session()
                            
                            # Get the actual user who is chatting (using new session)
                            conversation_user = memory_session.query(User).get(conversation.user_id)
                            if not conversation_user:
                                # Fallback: find user by username if not found by ID
                                conversation_user = memory_session.query(User).filter_by(username=user_id_for_memory).first()
                                if not conversation_user:
                                    # Create user if they don't exist
                                    conversation_user = User(
                                        username=user_id_for_memory,
                                        email=f'{user_id_for_memory}@glow.com',
                                        name=user_id_for_memory.title()
                                    )
                                    memory_session.add(conversation_user)
                                    memory_session.commit()  # Commit user creation in new session
                            
                            # Store memory for the conversation user
                            memory = UserMemory(
                                user_id=conversation_user.id,
                                fact=memory_extracted,
                                source_conversation_id=conversation_id  # Use conversation_id instead of conversation.id
                            )
                            memory_session.add(memory)
                            
                            # ✅ Commit memory in separate session
                            memory_session.commit()
                            print(f"✅ Memory saved successfully in separate session")
                            
                            # Emit real-time memory update via WebSocket (after successful save)
                            try:
                                memory_data = memory.to_dict()
                                emit_memory_update(conversation_user.username, memory_data)
                                print(f"📢 Memory update emitted via WebSocket")
                            except Exception as ws_error:
                                print(f"⚠️ WebSocket emit failed (memory still saved): {ws_error}")
                            
                            # Clean up the separate session
                            memory_session.close()
                            
                        except Exception as memory_error:
                            print(f"❌ Memory save failed in separate session: {memory_error}")
                            try:
                                memory_session.rollback()
                                memory_session.close()
                            except:
                                pass
                            # Assistant message is DEFINITELY safe since it's in a different session! 🎯
                
                # Send completion message (re-query conversation for updated title)
                with app.app_context():
                    final_conversation = Conversation.query.get(conversation_id)
                    yield f"data: {json.dumps({'type': 'complete', 'conversation_id': conversation_id, 'conversation_title': final_conversation.title if final_conversation else 'New Chat'})}\n\n"
                
            except Exception as e:
                print(f"💥 CRITICAL ERROR in streaming: {str(e)}")
                print(f"💥 Exception type: {type(e)}")
                import traceback
                print(f"💥 Full traceback: {traceback.format_exc()}")
                
                # 🚨 CRITICAL FIX: Wrap database rollback in app context
                try:
                    with app.app_context():
                        db.session.rollback()  # Clean rollback on any error
                        print("🔄 Database session rolled back successfully")
                except Exception as rollback_error:
                    print(f"⚠️ Failed to rollback database session: {rollback_error}")
                
                # Better error messages for common issues
                if "Read timed out" in str(e) or "timeout" in str(e).lower():
                    error_message = "OpenAI service is experiencing delays. Please try again in a moment."
                elif "Connection" in str(e):
                    error_message = "Connection to AI service failed. Please check your internet connection and try again."
                else:
                    error_message = f"An error occurred: {str(e)}"
                
                yield f"data: {json.dumps({'type': 'error', 'error': error_message})}\n\n"
        
        return Response(generate(), mimetype='text/plain', headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'  # Disable nginx buffering
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': f'An error occurred: {str(e)}'
        }), 500


@app.route('/api/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """Get a specific conversation with all messages"""
    try:
        conversation = Conversation.query.get(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
            
        return jsonify({
            'conversation': conversation.to_dict()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Delete a conversation and all its messages"""
    try:
        conversation = Conversation.query.get(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Delete all messages in the conversation first
        Message.query.filter_by(conversation_id=conversation.id).delete()
        
        # Update memories to remove the conversation reference (set to NULL instead of deleting memories)
        UserMemory.query.filter_by(source_conversation_id=conversation.id).update({'source_conversation_id': None})
        
        # Delete the conversation
        db.session.delete(conversation)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Conversation deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/memories/<memory_id>', methods=['DELETE'])
def delete_memory(memory_id):
    """Delete a specific memory from the database"""
    try:
        memory = UserMemory.query.get(memory_id)
        
        if not memory:
            return jsonify({'error': 'Memory not found'}), 404
        
        # Log the deletion
        print(f"🗑️ Deleting memory: {memory.fact[:50]}... (ID: {memory_id})")
        
        # Delete the memory
        db.session.delete(memory)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Memory deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error deleting memory: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/conversations/<conversation_id>', methods=['PATCH'])
def update_conversation(conversation_id):
    """Update conversation title"""
    try:
        data = request.get_json()
        
        if not data or 'title' not in data:
            return jsonify({'error': 'Title is required'}), 400
        
        conversation = Conversation.query.get(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Update the title
        conversation.title = data['title']
        conversation.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'conversation': conversation.to_dict(include_messages=False)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
# ================ SOCIAL NETWORK ROUTES ================

@app.route('/api/search-users', methods=['GET'])
def search_users():
    """Search for users by username"""
    try:
        username = request.args.get('username', '').strip()
        current_user_id = request.args.get('user_id', 'default_user')
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
            
        # Search for users with matching username (exact match for now)
        users = User.query.filter(User.username.ilike(f'%{username}%')).limit(10).all()
        
        # Get current user for relationship checking - try by username first, then by id
        current_user = User.query.filter_by(username=current_user_id).first()
        if not current_user:
            current_user = User.query.filter_by(id=current_user_id).first()
        if not current_user:
            return jsonify({'error': 'Current user not found'}), 404
        
        result = []
        for user in users:
            if user.id == current_user.id:
                continue  # Don't include self in search results
                
            user_data = user.to_dict(include_social=True)
            # Add relationship status
            user_data['relationship_status'] = 'none'
            
            if current_user.is_following(user):
                user_data['relationship_status'] = 'following'
            elif current_user.has_follow_request_from(user):
                user_data['relationship_status'] = 'pending_incoming'
            elif user.has_follow_request_from(current_user):
                user_data['relationship_status'] = 'pending_outgoing'
                
            result.append(user_data)
        
        return jsonify({
            'success': True,
            'users': result
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user-profile/<username>', methods=['GET'])
def get_user_profile(username):
    """Get a user's profile by username"""
    try:
        current_user_id = request.args.get('user_id', 'default_user')
        
        # Find the target user
        target_user = User.query.filter_by(username=username).first()
        if not target_user:
            return jsonify({'error': 'User not found'}), 404
            
        # Get current user - try by username first, then by id
        current_user = User.query.filter_by(username=current_user_id).first()
        if not current_user:
            current_user = User.query.filter_by(id=current_user_id).first()
        if not current_user:
            return jsonify({'error': 'Current user not found'}), 404
        
        # Determine relationship status and access level
        is_following = current_user.is_following(target_user)
        is_own_profile = current_user.id == target_user.id
        has_access = is_following or is_own_profile
        
        # Basic profile data
        profile_data = target_user.to_dict(include_social=True)
        
        # Add relationship status
        if is_own_profile:
            profile_data['relationship_status'] = 'own_profile'
        elif is_following:
            profile_data['relationship_status'] = 'following'
        elif current_user.has_follow_request_from(target_user):
            profile_data['relationship_status'] = 'pending_incoming'
        elif target_user.has_follow_request_from(current_user):
            profile_data['relationship_status'] = 'pending_outgoing'
        else:
            profile_data['relationship_status'] = 'none'
        
        profile_data['has_access'] = has_access
        profile_data['is_private'] = not has_access
        
        return jsonify({
            'success': True,
            'profile': profile_data
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/send-follow-request', methods=['POST'])
def send_follow_request():
    """Send a follow request to another user"""
    try:
        data = request.get_json()
        from_user_id = data.get('from_user_id')
        to_username = data.get('to_username')
        
        if not from_user_id or not to_username:
            return jsonify({'error': 'from_user_id and to_username are required'}), 400
        
        # Get users (from_user_id can be username or id)
        from_user = User.query.filter_by(username=from_user_id).first()
        if not from_user:
            from_user = User.query.filter_by(id=from_user_id).first()
        to_user = User.query.filter_by(username=to_username).first()
        
        if not from_user or not to_user:
            return jsonify({'error': 'User not found'}), 404
        
        if from_user.id == to_user.id:
            return jsonify({'error': 'Cannot follow yourself'}), 400
            
        # Check if already following
        if from_user.is_following(to_user):
            return jsonify({'error': 'Already following this user'}), 400
            
        # Check if follow request already exists
        existing_request = FollowRequest.query.filter_by(
            from_user_id=from_user.id,
            to_user_id=to_user.id
        ).first()
        
        if existing_request:
            return jsonify({'error': 'Follow request already sent'}), 400
        
        # Create follow request
        follow_request = FollowRequest(
            from_user_id=from_user.id,
            to_user_id=to_user.id
        )
        
        db.session.add(follow_request)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Follow request sent to {to_user.username}'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/cancel-follow-request', methods=['POST'])
def cancel_follow_request():
    """Cancel/unsend a follow request"""
    try:
        data = request.get_json()
        from_user_id = data.get('from_user_id')
        to_username = data.get('to_username')
        
        if not from_user_id or not to_username:
            return jsonify({'error': 'from_user_id and to_username are required'}), 400
        
        # Get users (from_user_id can be username or id)
        from_user = User.query.filter_by(username=from_user_id).first()
        if not from_user:
            from_user = User.query.filter_by(id=from_user_id).first()
        to_user = User.query.filter_by(username=to_username).first()
        
        if not from_user or not to_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Find and delete the follow request
        follow_request = FollowRequest.query.filter_by(
            from_user_id=from_user.id,
            to_user_id=to_user.id
        ).first()
        
        if not follow_request:
            return jsonify({'error': 'No follow request found to cancel'}), 404
        
        db.session.delete(follow_request)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Follow request to {to_user.username} cancelled'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/follow-requests', methods=['GET'])
def get_follow_requests():
    """Get all pending follow requests for a user"""
    try:
        user_id = request.args.get('user_id', 'default_user')
        
        user = User.query.filter_by(username=user_id).first()
        if not user:
            user = User.query.filter_by(id=user_id).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get all follow requests for this user
        follow_requests = user.received_follow_requests.all()
        
        return jsonify({
            'success': True,
            'follow_requests': [req.to_dict() for req in follow_requests]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/respond-follow-request', methods=['POST'])
def respond_follow_request():
    """Accept or decline a follow request"""
    try:
        data = request.get_json()
        request_id = data.get('request_id')
        action = data.get('action')  # 'accept' or 'decline'
        user_id = data.get('user_id')
        
        if not request_id or not action or not user_id:
            return jsonify({'error': 'request_id, action, and user_id are required'}), 400
        
        if action not in ['accept', 'decline']:
            return jsonify({'error': 'action must be accept or decline'}), 400
        
        # Get the user first to get their actual ID
        user = User.query.filter_by(username=user_id).first()
        if not user:
            user = User.query.filter_by(id=user_id).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get the follow request
        follow_request = FollowRequest.query.filter_by(
            id=request_id,
            to_user_id=user.id
        ).first()
        
        if not follow_request:
            return jsonify({'error': 'Follow request not found'}), 404
        
        from_user = User.query.filter_by(id=follow_request.from_user_id).first()
        to_user = User.query.filter_by(id=follow_request.to_user_id).first()
        
        if not from_user or not to_user:
            return jsonify({'error': 'User not found'}), 404
        
        if action == 'accept':
            # Add to followers/following relationship
            to_user.followers.append(from_user)
            db.session.commit()
            
            message = f'You are now following {to_user.username}'
        else:
            message = f'Follow request from {from_user.username} declined'
        
        # Remove the follow request
        db.session.delete(follow_request)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': message
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/unfollow', methods=['POST'])
def unfollow_user():
    """Unfollow a user"""
    try:
        data = request.get_json()
        follower_id = data.get('follower_id')
        following_username = data.get('following_username')
        
        if not follower_id or not following_username:
            return jsonify({'error': 'follower_id and following_username are required'}), 400
        
        follower = User.query.filter_by(id=follower_id).first()
        following = User.query.filter_by(username=following_username).first()
        
        if not follower or not following:
            return jsonify({'error': 'User not found'}), 404
        
        if not follower.is_following(following):
            return jsonify({'error': 'Not following this user'}), 400
        
        # Remove from following relationship
        follower.following.remove(following)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Unfollowed {following.username}'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ================ AUTHENTICATION ROUTES ================

@app.route('/api/login', methods=['POST'])
def login():
    """Simple username-based login"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        
        # Find user by username
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'message': f'Welcome back, {user.name}!',
            'user': user.to_dict(include_social=True)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/google-login', methods=['POST'])
def google_login():
    """Google OAuth login endpoint"""
    try:
        data = request.get_json()
        
        # Extract Google user info from the request
        email = data.get('email')
        name = data.get('name')
        given_name = data.get('given_name')
        family_name = data.get('family_name')
        picture = data.get('picture')
        google_id = data.get('google_id')
        
        if not email or not google_id:
            return jsonify({'error': 'Email and Google ID are required'}), 400
        
        # Check if user already exists by email or google_id
        user = User.query.filter((User.email == email) | (User.google_id == google_id)).first()
        
        if user:
            # Update existing user with Google info if not already set
            if not user.google_id:
                user.google_id = google_id
            if not user.given_name:
                user.given_name = given_name
            if not user.family_name:
                user.family_name = family_name
            if not user.picture:
                user.picture = picture
            # Update name if Google provides a full name and current name is just username
            if name and (user.name == user.username or not user.name):
                user.name = name
                
            db.session.commit()
        else:
            # Create new user from Google info
            # Generate username from email (before @)
            username_base = email.split('@')[0]
            username = username_base
            counter = 1
            
            # Ensure username is unique
            while User.query.filter_by(username=username).first():
                username = f"{username_base}_{counter}"
                counter += 1
            
            user = User(
                username=username,
                email=email,
                name=name or given_name or username,
                google_id=google_id,
                given_name=given_name,
                family_name=family_name,
                picture=picture
            )
            
            db.session.add(user)
            db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Welcome, {user.name}!',
            'user': user.to_dict(include_social=True)
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Google login error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    """Simple logout endpoint"""
    try:
        return jsonify({
            'success': True,
            'message': 'Logged out successfully'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/current-user', methods=['GET'])
def get_current_user():
    """Get current user info - useful for checking login status"""
    try:
        username = request.args.get('username')
        
        if not username:
            return jsonify({'error': 'Username parameter required'}), 400
        
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'user': user.to_dict(include_social=True)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user-greeting/<username>', methods=['GET'])
def get_user_greeting(username):
    """Get user's given name for greeting display"""
    try:
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Return given_name, fallback to name, then username
        display_name = user.given_name or user.name or user.username
        
        return jsonify({
            'success': True,
            'given_name': display_name,
            'username': user.username
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/user-song/<username>', methods=['GET'])
def get_user_song(username):
    """Get a personalized song recommendation for a user based on their conversation history"""
    try:
        # Get user
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        # Get all conversations for this user
        conversations = Conversation.query.filter_by(user_id=user.id).all()
        
        if not conversations:
            # Default song for new users
            return jsonify({
                'success': True,
                'song': {
                    'title': 'Blank Space',
                    'artist': 'Taylor Swift',
                    'reason': 'A perfect start to your story - full of possibilities and new beginnings!'
                }
            })
        
        # Get comprehensive conversation context
        all_messages = []
        for conversation in conversations:
            messages = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.created_at.asc()).all()
            all_messages.extend([msg.content for msg in messages if msg.role == 'user'])
        
        context = " ".join(all_messages)
        
        # Generate personalized song recommendation using OpenAI
        import time
        current_time = int(time.time())
        prompt = f"""Given all our conversations with {user.name}: "{context}"

Give a pop culture song to best describe their life (should be in the theme of rap, pop, and kpop and must be a part of pop culture) --- in terms how they feel when they listen to the song, not the lyrics. Suggested artists include Taylor Swift, Kanye West, Drake, Ariana Grande, and Black Pink.

Please provide a fresh, different recommendation each time (current timestamp: {current_time}). Consider their current mood and recent conversations.

Return ONLY a JSON object with this exact format:
{{
    "title": "Song Title",
    "artist": "Artist Name", 
    "reason": "Brief explanation of why this song captures their vibe (1-2 sentences)"
}}"""
        
        try:
            # Call OpenAI API directly
            if not openai_available:
                return jsonify({
                    'success': True,
                    'song': {
                        'title': 'Good 4 U',
                        'artist': 'Olivia Rodrigo',
                        'reason': 'Captures your vibrant energy and passion for life!'
                    }
                })
            
            headers = {
                'Authorization': f'Bearer {OPENAI_API_KEY}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'model': 'gpt-3.5-turbo',
                'messages': [
                    {"role": "system", "content": "You are a music curator that understands people's vibes and recommends songs that capture their essence. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                'max_tokens': 150,
                'temperature': 0.9
            }
            
            response = requests.post(
                'https://api.openai.com/v1/chat/completions',
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                response_data = response.json()
                song_response = response_data['choices'][0]['message']['content'].strip()
                
                # Parse the JSON response
                import json
                song_data = json.loads(song_response)
            else:
                raise Exception(f"OpenAI API error: {response.status_code}")
            
            return jsonify({
                'success': True,
                'song': song_data
            })
            
        except Exception as e:
            print(f"Error generating song: {str(e)}")
            # Fallback song
            return jsonify({
                'success': True,
                'song': {
                    'title': 'Good 4 U',
                    'artist': 'Olivia Rodrigo',
                    'reason': 'Captures your vibrant energy and passion for life!'
                }
            })
        
    except Exception as e:
        print(f"Error getting user song: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get song recommendation'
        }), 500


@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    """Transcribe audio using OpenAI's Whisper API"""
    try:
        # Check if audio file is present
        if 'audio' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No audio file provided'
            }), 400

        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No audio file selected'
            }), 400

        # Check if OpenAI API is available
        if not openai_available:
            return jsonify({
                'success': False,
                'error': 'OpenAI API key is not properly configured'
            }), 500

        print(f"Transcription request - File: {audio_file.filename}, Size: {audio_file.content_length}, Type: {audio_file.mimetype}")
        
        # Prepare the file for OpenAI Whisper API
        files = {
            'file': (audio_file.filename, audio_file.stream, audio_file.mimetype),
            'model': (None, 'whisper-1')
        }
        
        headers = {
            'Authorization': f'Bearer {OPENAI_API_KEY}'
        }

        print("Sending request to OpenAI Whisper API...")
        
        # Call OpenAI Whisper API with optimized settings
        response = requests.post(
            'https://api.openai.com/v1/audio/transcriptions',
            headers=headers,
            files=files,
            timeout=15  # Reduced timeout for faster response
        )
        
        print(f"OpenAI API Response: {response.status_code}")

        if response.status_code == 200:
            transcription_data = response.json()
            transcribed_text = transcription_data.get('text', '').strip()
            
            return jsonify({
                'success': True,
                'text': transcribed_text
            })
        else:
            try:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                error_message = error_data.get('error', {}).get('message', f'Whisper API error: {response.status_code}')
                print(f"OpenAI API Error: {response.status_code} - {error_message}")
                print(f"Response content: {response.text[:500]}...")
            except Exception as parse_error:
                error_message = f'Whisper API error: {response.status_code}'
                print(f"Failed to parse error response: {parse_error}")
                print(f"Raw response: {response.text[:500]}...")
            
            return jsonify({
                'success': False,
                'error': error_message
            }), response.status_code

    except Exception as e:
        print(f"Error in transcribe_audio: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error during transcription'
        }), 500


@app.route('/api/messages/<message_id>', methods=['PATCH'])
def edit_message(message_id):
    """Edit a message content"""
    try:
        data = request.get_json()
        new_content = data.get('new_content')
        
        if not new_content or not new_content.strip():
            return jsonify({
                'success': False,
                'error': 'New content is required'
            }), 400
        
        # Find the message
        message = Message.query.filter_by(id=message_id).first()
        if not message:
            return jsonify({
                'success': False,
                'error': 'Message not found'
            }), 404
        
        # Only allow editing user messages
        if message.role != 'user':
            return jsonify({
                'success': False,
                'error': 'Only user messages can be edited'
            }), 403
        
        # Update the message
        message.content = new_content.strip()
        message.edited = True
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': message.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error editing message: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500


if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Create tables if they don't exist
    print("🚀 Starting Glow server with WebSocket support...")
    socketio.run(app, debug=True, host='0.0.0.0', port=5001, allow_unsafe_werkzeug=True)
