# Render Backend + Vercel Frontend Setup Guide

## 🎯 Architecture
- **Frontend**: Vercel (Next.js app)
- **Backend**: Render (Docker with Python/yt-dlp)

---

## 📋 What You Need to Provide

### 1. **Render Backend URL** (after deployment)
After deploying to Render, you'll get a URL like:
- `https://grablink-xxxx.onrender.com`
- Or your custom domain

**You'll provide this after Step 2 below.**

---

## 🚀 Step-by-Step Setup

### **Step 1: Deploy Backend to Render**

1. **Go to [render.com](https://render.com)** and sign up/login

2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `grablink` repository

3. **Configure Service**:
   - **Name**: `grablink-backend` (or any name)
   - **Environment**: `Docker`
   - **Dockerfile Path**: `./Dockerfile` (should auto-detect)
   - **Plan**: `Free` (or paid if you want)
   - **Auto-Deploy**: `Yes`

4. **Set Environment Variables** (in Render dashboard):
   ```
   NODE_ENV=production
   UMAMI_API_KEY=your_umami_api_key_here
   UMAMI_WEBSITE_ID=5d7c0418-ad3d-43b6-be7e-b3ff326e86b7
   UMAMI_API_BASE_URL=https://api.umami.is/v1
   ```

5. **Deploy**:
   - Click "Create Web Service"
   - Wait for build to complete (~5-10 minutes)
   - **Copy the service URL** (e.g., `https://grablink-xxxx.onrender.com`)

---

### **Step 2: Configure Vercel Frontend**

1. **Go to Vercel Dashboard** → Your Project → Settings → Environment Variables

2. **Add this environment variable**:
   ```
   Key: NEXT_PUBLIC_RENDER_BACKEND_URL
   Value: https://your-render-service.onrender.com
   ```
   ⚠️ **Important**: 
   - Use the URL from Step 1 (your Render service URL)
   - **No trailing slash** (e.g., `https://grablink-xxxx.onrender.com`)
   - Select **Production**, **Preview**, and **Development** environments

3. **Redeploy Vercel**:
   - Go to Deployments
   - Click "..." on latest deployment → "Redeploy"
   - Or push a new commit to trigger auto-deploy

---

### **Step 3: Test**

1. **Test Backend** (Render):
   - Visit: `https://your-render-service.onrender.com/api/health`
   - Should show Python, yt-dlp, FFmpeg status

2. **Test Frontend** (Vercel):
   - Visit your Vercel site
   - Try downloading a video
   - Check browser console for API calls to Render backend

---

## ✅ What I've Done (Code Changes)

- ✅ Updated `app/admin/page.tsx` - Uses Render backend URL when on Vercel
- ✅ Updated `app/components/VideoDownloader.tsx` - Uses Render backend URL when on Vercel
- ✅ Created `render.yaml` - Render deployment configuration
- ✅ Code automatically detects Vercel vs localhost and routes API calls correctly

---

## 🔧 How It Works

**On Vercel (Production)**:
- Frontend detects it's on Vercel
- API calls go to: `NEXT_PUBLIC_RENDER_BACKEND_URL + /api/...`
- Example: `https://grablink-xxxx.onrender.com/api/video/info`

**On Localhost (Development)**:
- API calls use relative URLs: `/api/...`
- Works with `npm run dev` (assumes backend runs locally)

---

## ⚠️ Important Notes

1. **CORS**: Render backend needs to allow requests from Vercel domain
   - Your API routes already have CORS headers, so this should work

2. **Environment Variables**:
   - **Vercel**: Set `NEXT_PUBLIC_RENDER_BACKEND_URL`
   - **Render**: Set `UMAMI_API_KEY`, `UMAMI_WEBSITE_ID`, etc.

3. **Free Tier Limits**:
   - **Render Free**: Service spins down after 15 min inactivity (cold start ~30s)
   - **Vercel Free**: 10s function timeout (frontend only, so fine)

---

## 🐛 Troubleshooting

**API calls failing?**
- Check `NEXT_PUBLIC_RENDER_BACKEND_URL` is set in Vercel
- Check Render service is running (not sleeping)
- Check browser console for errors

**Render service sleeping?**
- Free tier spins down after inactivity
- First request after sleep takes ~30s (cold start)
- Consider upgrading to paid plan for always-on

**Still having issues?**
- Check Render logs: Dashboard → Your Service → Logs
- Check Vercel logs: Dashboard → Your Project → Functions → Logs

---

## 📝 Summary

1. Deploy to Render (get backend URL)
2. Set `NEXT_PUBLIC_RENDER_BACKEND_URL` in Vercel
3. Redeploy Vercel
4. Test!

**You're all set!** 🎉

