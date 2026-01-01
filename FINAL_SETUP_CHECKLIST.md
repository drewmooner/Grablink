# ✅ Final Setup Checklist

## 🎯 Current Status
- ✅ **Render Backend**: Deployed with Docker (Python, yt-dlp, FFmpeg available)
- ✅ **Code Updated**: Frontend routes to Render backend when on Vercel
- ✅ **Environment Variables**: All set

---

## 🔍 Final Verification Steps

### 1. **Vercel Environment Variable** (CRITICAL)
Make sure this is set in Vercel:
- **Key**: `NEXT_PUBLIC_RENDER_BACKEND_URL`
- **Value**: `https://grablink.onrender.com` (no trailing slash)
- **Environments**: Production, Preview, Development (all checked)

### 2. **Redeploy Vercel** (REQUIRED)
After setting the env var, you MUST redeploy:
- Go to Vercel Dashboard → Deployments
- Click "..." on latest deployment → "Redeploy"
- Wait for build to complete

### 3. **Test the Connection**

**Test 1: Backend Health Check**
- Visit: `https://grablink.onrender.com/api/health`
- ✅ Should show Python, yt-dlp, FFmpeg as available

**Test 2: Frontend → Backend**
1. Visit your Vercel site (e.g., `https://grablink.cloud`)
2. Open browser console (F12 → Console)
3. Paste a video URL (TikTok, Instagram, etc.)
4. Check console logs - you should see:
   ```
   [VideoDownloader] Hostname: grablink.cloud
   [VideoDownloader] Render backend URL from env: https://grablink.onrender.com
   [VideoDownloader] Using Render backend: https://grablink.onrender.com
   ```
5. Try to download - should work now! ✅

---

## 🐛 Troubleshooting

### If you see: "❌ NEXT_PUBLIC_RENDER_BACKEND_URL not set!"
**Solution**: 
1. Check Vercel → Settings → Environment Variables
2. Make sure it's set correctly
3. **Redeploy Vercel** (env vars are injected at build time)

### If API calls still fail:
1. Check browser console for the actual API URL being called
2. Verify Render service is running (not sleeping)
3. Check Render logs for errors

### If Render service is sleeping:
- Free tier spins down after 15 min inactivity
- First request takes ~30s (cold start)
- Subsequent requests are fast

---

## ✅ Success Indicators

You'll know it's working when:
1. ✅ Video scanning works (no "Python not installed" error)
2. ✅ Video downloads work
3. ✅ Admin panel stats load correctly
4. ✅ Browser console shows API calls going to `grablink.onrender.com`

---

## 🎉 You're Done!

Once you see the success indicators above, everything is working!

**Architecture:**
- **Frontend**: Vercel (Next.js)
- **Backend**: Render (Docker with Python/yt-dlp)
- **API Calls**: Vercel frontend → Render backend

