# 🚀 Glow Desktop Project - Deployment Guide

## 📋 Prerequisites

- GitHub account
- OpenAI API key
- Chosen deployment platform account

## 🛠️ Option 1: Vercel + Railway (Recommended)

### Backend Deployment (Railway)

1. **Sign up for Railway**: https://railway.app
2. **Create new project** → "Deploy from GitHub repo"
3. **Connect your GitHub repo**
4. **Add environment variables**:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   SECRET_KEY=your-super-secret-production-key
   FLASK_ENV=production
   ```
5. **Railway will automatically**:
   - Detect your Python app
   - Set up PostgreSQL database
   - Set `DATABASE_URL` automatically
   - Deploy from `backend/` folder

### Frontend Deployment (Vercel)

1. **Sign up for Vercel**: https://vercel.com
2. **Import your GitHub repo**
3. **Configure build settings**:
   - Root Directory: `./` (project root)
   - Build Command: `npm run build`
   - Output Directory: `build`
4. **Add environment variables**:
   ```
   REACT_APP_API_URL=https://your-backend-url.railway.app
   REACT_APP_WS_URL=https://your-backend-url.railway.app
   ```
5. **Update Railway backend**:
   - Add `FRONTEND_URL=https://your-app.vercel.app`

## 🛠️ Option 2: Netlify + Render

### Backend (Render)
1. Sign up for Render
2. Create "Web Service" from GitHub
3. Use these settings:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
4. Add environment variables (same as Railway)

### Frontend (Netlify)
1. Sign up for Netlify
2. Connect GitHub repo
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
4. Add environment variables (same as Vercel)

## 🛠️ Option 3: Heroku (All-in-One)

### Setup
1. Install Heroku CLI
2. Create two apps:
   ```bash
   heroku create your-app-backend
   heroku create your-app-frontend
   ```

### Backend Deployment
```bash
cd backend
git init
heroku git:remote -a your-app-backend
heroku addons:create heroku-postgresql:mini
heroku config:set OPENAI_API_KEY=your_key_here
heroku config:set SECRET_KEY=your_secret_key
heroku config:set FLASK_ENV=production
git add .
git commit -m "Deploy backend"
git push heroku main
```

### Frontend Deployment
```bash
cd ..  # Back to project root
heroku config:set REACT_APP_API_URL=https://your-app-backend.herokuapp.com -a your-app-frontend
heroku config:set REACT_APP_WS_URL=https://your-app-backend.herokuapp.com -a your-app-frontend
heroku buildpacks:add mars/create-react-app -a your-app-frontend
git add .
git commit -m "Deploy frontend"
git subtree push --prefix=/ heroku main
```

## 🔧 Environment Variables Guide

### Backend Required Variables
- `OPENAI_API_KEY`: Your OpenAI API key
- `DATABASE_URL`: PostgreSQL connection string (auto-set by hosting)
- `SECRET_KEY`: Random secret for Flask sessions
- `FLASK_ENV`: Set to `production`
- `FRONTEND_URL`: Your frontend domain (for CORS)

### Frontend Required Variables
- `REACT_APP_API_URL`: Your backend URL
- `REACT_APP_WS_URL`: Your backend URL (for WebSockets)

## 🚨 Security Checklist

- [ ] **Remove API keys from config.py** - Use environment variables only
- [ ] **Use strong SECRET_KEY** in production
- [ ] **Enable HTTPS** on both frontend and backend
- [ ] **Verify CORS origins** are restricted to your domain
- [ ] **Test all API endpoints** after deployment

## 🧪 Testing Deployment

1. **Backend health check**: Visit `https://your-backend-url/api/user-greeting/test`
2. **Frontend**: Visit your frontend URL
3. **Test features**:
   - [ ] Google OAuth login
   - [ ] Chat functionality
   - [ ] Real-time memory updates
   - [ ] Profile page
   - [ ] File upload

## 📊 Monitoring

### Railway
- View logs in Railway dashboard
- Monitor database usage
- Check API response times

### Vercel
- View function logs
- Monitor build performance
- Check Core Web Vitals

## 🔄 Updates & CI/CD

### Automatic Deployments
Both Railway and Vercel support automatic deployments from GitHub:
1. Push to `main` branch
2. Platform detects changes
3. Automatically builds and deploys
4. Zero-downtime deployment

### Manual Deployments
```bash
# Update backend
git push  # Railway auto-deploys

# Update frontend  
git push  # Vercel auto-deploys
```

## 💰 Cost Estimates

### Railway + Vercel
- **Railway**: $5/month (hobby plan)
- **Vercel**: Free for personal projects
- **Total**: ~$5/month

### Render + Netlify
- **Render**: Free tier (with limitations)
- **Netlify**: Free tier
- **Total**: Free (with usage limits)

### Heroku
- **Backend**: $7/month (Eco dyno)
- **Database**: $9/month (Mini PostgreSQL)
- **Frontend**: Can be hosted elsewhere for free
- **Total**: ~$16/month

## 📞 Support

If you encounter issues:
1. Check platform-specific logs
2. Verify environment variables
3. Test API endpoints individually
4. Check CORS configuration

## 🎉 Go Live!

Once deployed, your Glow app will be accessible worldwide! Share your app URL and start connecting with users globally.
