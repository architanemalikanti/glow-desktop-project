#!/usr/bin/env python3
"""
Database migration script to add social network features
Adds: name column to users, user_follows table, follow_requests table
"""

import sys
import os

# Add the backend directory to path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db, User, FollowRequest, user_follows
from sqlalchemy import text

# Import config
try:
    from config import DATABASE_URL, SECRET_KEY
except ImportError:
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+psycopg://architanemalikanti@localhost:5432/glow_db')
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = SECRET_KEY
    
    db.init_app(app)
    return app

def migrate_database():
    """Run the database migration"""
    app = create_app()
    
    with app.app_context():
        print("🔄 Starting social features migration...")
        
        try:
            # Check if name column exists in users table
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='name'
            """)).fetchone()
            
            if not result:
                print("➕ Adding 'name' column to users table...")
                db.session.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR(100)"))
                
                # Set default names for existing users (username capitalized)
                print("🔧 Setting default names for existing users...")
                db.session.execute(text("""
                    UPDATE users 
                    SET name = INITCAP(username) 
                    WHERE name IS NULL
                """))
                
                # Make name column NOT NULL
                db.session.execute(text("ALTER TABLE users ALTER COLUMN name SET NOT NULL"))
                print("✅ 'name' column added and populated")
            else:
                print("✅ 'name' column already exists")
            
            # Create follow_requests table if it doesn't exist
            print("➕ Creating follow_requests table...")
            db.session.execute(text("""
                CREATE TABLE IF NOT EXISTS follow_requests (
                    id VARCHAR(36) PRIMARY KEY,
                    from_user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                    to_user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT unique_follow_request UNIQUE (from_user_id, to_user_id)
                )
            """))
            print("✅ follow_requests table created")
            
            # Create user_follows table if it doesn't exist
            print("➕ Creating user_follows table...")
            db.session.execute(text("""
                CREATE TABLE IF NOT EXISTS user_follows (
                    follower_id VARCHAR(36) NOT NULL REFERENCES users(id),
                    following_id VARCHAR(36) NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (follower_id, following_id)
                )
            """))
            print("✅ user_follows table created")
            
            # Commit all changes
            db.session.commit()
            print("🎉 Social features migration completed successfully!")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Migration failed: {str(e)}")
            raise e

if __name__ == "__main__":
    migrate_database()

