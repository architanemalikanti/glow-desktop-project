#!/usr/bin/env python3
"""
🔐 Secure Config Setup Script
Run this script to prepare your app for deployment by securing API keys.
"""

import os
import secrets

def create_env_file():
    """Create a .env file with secure configurations"""
    
    # Read current config if it exists
    current_openai_key = ""
    try:
        from backend.config import OPENAI_API_KEY
        if OPENAI_API_KEY and OPENAI_API_KEY != "your_openai_api_key_here":
            current_openai_key = OPENAI_API_KEY
    except ImportError:
        pass
    
    # Generate a secure secret key
    secure_secret = secrets.token_urlsafe(32)
    
    env_content = f"""# 🔐 Production Environment Variables
# DO NOT COMMIT THIS FILE TO GIT!

# OpenAI API Key (required)
OPENAI_API_KEY={current_openai_key}

# Database URL (will be set by hosting provider)
DATABASE_URL=postgresql+psycopg://username@localhost:5432/glow_db

# Flask Secret Key (randomly generated)
SECRET_KEY={secure_secret}

# Environment
FLASK_ENV=production

# Frontend URL (update with your actual domain)
FRONTEND_URL=https://your-app.vercel.app
"""
    
    # Write .env file
    with open('backend/.env', 'w') as f:
        f.write(env_content)
    
    print("✅ Created backend/.env file")
    print("⚠️  IMPORTANT: Add .env to your .gitignore file!")
    print("📝 Update the FRONTEND_URL in .env with your actual domain")

def update_gitignore():
    """Update .gitignore to exclude sensitive files"""
    
    gitignore_additions = """
# Environment variables
.env
.env.local
.env.production
.env.development

# Config files with secrets
backend/config.py

# OS files
.DS_Store
Thumbs.db
"""
    
    gitignore_path = '.gitignore'
    
    # Read existing .gitignore
    existing_content = ""
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r') as f:
            existing_content = f.read()
    
    # Add new rules if not already present
    if '.env' not in existing_content:
        with open(gitignore_path, 'a') as f:
            f.write(gitignore_additions)
        print("✅ Updated .gitignore to exclude sensitive files")
    else:
        print("✅ .gitignore already configured")

def create_example_env():
    """Create example .env file for documentation"""
    
    example_content = """# 🔐 Environment Variables Template
# Copy this to .env and fill in your actual values

# OpenAI API Key (required)
OPENAI_API_KEY=your_openai_api_key_here

# Database URL (adjust for your database provider)
DATABASE_URL=postgresql+psycopg://username@localhost:5432/glow_db

# Flask Secret Key (generate a secure random key)
SECRET_KEY=your-super-secret-key-here

# Environment (development/production)
FLASK_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
"""
    
    with open('backend/.env.example', 'w') as f:
        f.write(example_content)
    
    print("✅ Created backend/.env.example template")

def main():
    """Main setup function"""
    print("🔐 Setting up secure configuration for deployment...")
    print()
    
    create_env_file()
    create_example_env()
    update_gitignore()
    
    print()
    print("🎉 Security setup complete!")
    print()
    print("📋 Next steps:")
    print("1. Review backend/.env and update values as needed")
    print("2. Commit your changes (excluding .env)")
    print("3. Deploy using the instructions in DEPLOYMENT.md")
    print("4. Set environment variables in your hosting platform")
    print()
    print("⚠️  NEVER commit .env files to version control!")

if __name__ == "__main__":
    main()
