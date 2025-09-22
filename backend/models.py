from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()

# Association table for user follows (many-to-many relationship)
user_follows = db.Table('user_follows',
    db.Column('follower_id', db.String(36), db.ForeignKey('users.id'), primary_key=True),
    db.Column('following_id', db.String(36), db.ForeignKey('users.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)  # Display name for profile
    
    # Google OAuth fields
    google_id = db.Column(db.String(100), unique=True, nullable=True)  # Google's unique ID
    given_name = db.Column(db.String(50), nullable=True)  # First name from Google
    family_name = db.Column(db.String(50), nullable=True)  # Last name from Google
    picture = db.Column(db.String(500), nullable=True)  # Profile picture URL from Google
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship with conversations and memories
    conversations = db.relationship('Conversation', backref='user', lazy=True, cascade='all, delete-orphan')
    memories = db.relationship('UserMemory', backref='user', lazy=True, cascade='all, delete-orphan')
    
    # Social relationships
    # Users I'm following
    following = db.relationship(
        'User', 
        secondary='user_follows',
        primaryjoin='User.id==user_follows.c.follower_id',
        secondaryjoin='User.id==user_follows.c.following_id',
        backref='followers',
        lazy='dynamic'
    )
    
    # Follow requests I've sent
    sent_follow_requests = db.relationship('FollowRequest', foreign_keys='FollowRequest.from_user_id', backref='from_user', lazy='dynamic')
    
    # Follow requests I've received
    received_follow_requests = db.relationship('FollowRequest', foreign_keys='FollowRequest.to_user_id', backref='to_user', lazy='dynamic')
    
    def to_dict(self, include_social=False):
        result = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'name': self.name,
            'google_id': self.google_id,
            'given_name': self.given_name,
            'family_name': self.family_name,
            'picture': self.picture,
            'created_at': self.created_at.isoformat()
        }
        
        if include_social:
            try:
                result.update({
                    'followers_count': len(list(self.followers)),
                    'following_count': len(list(self.following)),
                    'pending_requests_count': len(list(self.received_follow_requests))
                })
            except Exception:
                # Fallback for relationship counting
                result.update({
                    'followers_count': 0,
                    'following_count': 0,
                    'pending_requests_count': 0
                })
            
        return result
    
    def is_following(self, user):
        """Check if this user is following another user"""
        return self.following.filter_by(id=user.id).first() is not None
    
    def has_follow_request_from(self, user):
        """Check if this user has a pending follow request from another user"""
        return self.received_follow_requests.filter_by(from_user_id=user.id).first() is not None

class Conversation(db.Model):
    __tablename__ = 'conversations'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=True)  # Optional: first message preview
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with messages
    messages = db.relationship('Message', backref='conversation', lazy=True, cascade='all, delete-orphan', order_by='Message.created_at')
    
    def to_dict(self, include_messages=True):
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        
        if include_messages:
            result['messages'] = [message.to_dict() for message in self.messages]
            
        return result

class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = db.Column(db.String(36), db.ForeignKey('conversations.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'system', 'user', 'assistant'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    edited = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'role': self.role,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'edited': self.edited
        }

class UserMemory(db.Model):
    __tablename__ = 'user_memories'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    fact = db.Column(db.Text, nullable=False)
    source_conversation_id = db.Column(db.String(36), db.ForeignKey('conversations.id'))
    is_displayed = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'fact': self.fact,
            'source_conversation_id': self.source_conversation_id,
            'is_displayed': self.is_displayed,
            'created_at': self.created_at.isoformat()
        }

class FollowRequest(db.Model):
    __tablename__ = 'follow_requests'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    from_user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    to_user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Ensure no duplicate follow requests
    __table_args__ = (db.UniqueConstraint('from_user_id', 'to_user_id', name='unique_follow_request'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'from_user_id': self.from_user_id,
            'to_user_id': self.to_user_id,
            'from_user': self.from_user.to_dict() if self.from_user else None,
            'created_at': self.created_at.isoformat()
        }