#!/usr/bin/env python3
"""
Migration script to add Google OAuth fields to existing User table
Run this to add the new Google authentication fields to your database
"""

from flask import Flask
from models import db, User
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import config
try:
    from config import DATABASE_URL, SECRET_KEY
except ImportError:
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+psycopg://architanemalikanti@localhost:5432/glow_db')
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = SECRET_KEY

db.init_app(app)

def migrate_google_oauth():
    """Add Google OAuth fields to existing User table"""
    with app.app_context():
        try:
            print("🔄 Starting Google OAuth migration...")
            
            # Check if the columns already exist
            inspector = db.inspect(db.engine)
            existing_columns = [col['name'] for col in inspector.get_columns('users')]
            
            new_columns = ['google_id', 'given_name', 'family_name', 'picture']
            columns_to_add = [col for col in new_columns if col not in existing_columns]
            
            if not columns_to_add:
                print("✅ All Google OAuth columns already exist!")
                return
            
            print(f"📝 Adding columns: {columns_to_add}")
            
            # Add the new columns using raw SQL
            with db.engine.connect() as conn:
                if 'google_id' in columns_to_add:
                    conn.execute(db.text('ALTER TABLE users ADD COLUMN google_id VARCHAR(100) UNIQUE'))
                    print("   ✅ Added google_id column")
                
                if 'given_name' in columns_to_add:
                    conn.execute(db.text('ALTER TABLE users ADD COLUMN given_name VARCHAR(50)'))
                    print("   ✅ Added given_name column")
                
                if 'family_name' in columns_to_add:
                    conn.execute(db.text('ALTER TABLE users ADD COLUMN family_name VARCHAR(50)'))
                    print("   ✅ Added family_name column")
                
                if 'picture' in columns_to_add:
                    conn.execute(db.text('ALTER TABLE users ADD COLUMN picture VARCHAR(500)'))
                    print("   ✅ Added picture column")
                
                conn.commit()
            
            print("🎉 Google OAuth migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            raise

if __name__ == '__main__':
    migrate_google_oauth()
