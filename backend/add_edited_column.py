#!/usr/bin/env python3
"""
Migration script to add the 'edited' column to the messages table.
Run this once to update the existing database schema.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import text

def add_edited_column():
    """Add the edited column to the messages table"""
    with app.app_context():
        try:
            # Check if the column already exists
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='messages' AND column_name='edited'
            """))
            
            if result.fetchone():
                print("✅ 'edited' column already exists in messages table")
                return
            
            # Add the column with default value False
            db.session.execute(text("""
                ALTER TABLE messages 
                ADD COLUMN edited BOOLEAN DEFAULT FALSE
            """))
            
            # Update all existing messages to have edited = False
            db.session.execute(text("""
                UPDATE messages 
                SET edited = FALSE 
                WHERE edited IS NULL
            """))
            
            db.session.commit()
            print("✅ Successfully added 'edited' column to messages table")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error adding 'edited' column: {e}")

if __name__ == '__main__':
    add_edited_column()
