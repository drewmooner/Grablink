# Umami Event Tracking - Testing Instructions

## ✅ What's Being Tracked

### 1. **Visits (Pageviews)**
- **Automatic**: Tracked by Umami script in `app/layout.tsx`
- **Event**: Automatically tracked on every page load
- **No code needed**: Umami script handles this automatically

### 2. **Download Events**
- **"Download Video"**: Tracked when video downloads complete
- **"Download Audio"**: Tracked when audio downloads complete
- **Tracking locations**:
  - ✅ `triggerDownloadWithProgress` (line 397) - Main download with progress
  - ✅ Simple download button (line 1002) - Fallback download
  - ✅ Error fallback (line 429) - When progress download fails

## 🧪 How to Test

### Step 1: Verify Umami Script is Loaded
1. Open your browser's Developer Console (F12)
2. Go to your site: `http://localhost:3000` (or your production URL)
3. In the console, type: `window.umami`
4. **Expected**: Should return a function, not `undefined`
5. If undefined, check Network tab to see if `https://cloud.umami.is/script.js` loaded

### Step 2: Test Visit Tracking
1. Open your site in a new incognito/private window
2. Navigate to different pages
3. **Check**: Go to Umami dashboard at `https://cloud.umami.is/share/SgUhlS4KYP3zIBI7`
4. **Expected**: You should see a new pageview appear within a few seconds

### Step 3: Test Download Video Event
1. Go to your site
2. Paste a video URL (e.g., YouTube, Instagram)
3. Wait for video to scan
4. Click "Download Video" button
5. Wait for download to complete
6. **Check Console**: Should see `[VideoDownloader] Tracked Umami event: Download Video`
7. **Check Umami Dashboard**: 
   - Go to Events section
   - Look for "Download Video" event
   - Count should increase

### Step 4: Test Download Audio Event
1. On your site, check the "Download audio only (MP3)" checkbox
2. Paste a video URL
3. Wait for video to scan
4. Click "Download" button
5. Wait for download to complete
6. **Check Console**: Should see `[VideoDownloader] Tracked Umami event: Download Audio`
7. **Check Umami Dashboard**: 
   - Go to Events section
   - Look for "Download Audio" event
   - Count should increase

### Step 5: Test Admin Panel Stats
1. Go to admin panel: `http://localhost:3000/admin?pw=kwiny191433`
2. **Check Console**: Should see logs like:
   - `[Admin] All-time stats: { video: X, audio: Y, pageviews: Z }`
   - `[Admin] Today stats: { video: X, audio: Y, pageviews: Z }`
3. **Check UI**: Stats cards should show:
   - Total Downloads (video + audio)
   - Today's Downloads
   - Video Downloads (total and today)
   - Audio Downloads (total and today)
   - Revenue calculation

### Step 6: Test API Route Directly
1. Open browser or use curl/Postman
2. Test endpoint: `http://localhost:3000/api/admin/umami?type=all`
3. **Expected Response**:
   ```json
   {
     "stats": {...},
     "pageviews": 123,
     "events": [...],
     "videoDownloads": 45,
     "audioDownloads": 12
   }
   ```

### Step 7: Verify .env File
1. Check that `.env` file exists in project root
2. Verify it contains:
   ```
   UMAMI_API_KEY=api_pNOGm2RRn3CxCJNhxi4LKiBkiMTcDP8u
   UMAMI_WEBSITE_ID=5d7c0418-ad3d-43b6-be7e-b3ff326e86b7
   ```
3. **Important**: Restart your dev server after creating/updating `.env` file

## 🔍 Debugging Tips

### If events aren't showing in Umami:
1. **Check browser console** for errors
2. **Verify Umami script loaded**: `window.umami` should exist
3. **Check network tab**: Look for requests to `cloud.umami.is`
4. **Wait a few seconds**: Umami may take 10-30 seconds to update
5. **Check Umami dashboard**: Events might be under "Events" tab, not "Stats"

### If admin panel shows 0:
1. **Check server logs** for API errors
2. **Verify .env file** is loaded (restart server)
3. **Test API route directly**: `http://localhost:3000/api/admin/umami?type=all`
4. **Check Umami API key** is valid and has access to website

### If tracking code doesn't run:
1. **Check console logs**: Should see `[VideoDownloader] Tracked Umami event: ...`
2. **Verify download completed**: Tracking only happens after successful download
3. **Check for JavaScript errors** that might prevent execution

## 📊 Expected Results

After testing, you should see:
- ✅ Pageviews increasing in Umami dashboard
- ✅ "Download Video" events in Umami Events section
- ✅ "Download Audio" events in Umami Events section
- ✅ Admin panel showing correct counts
- ✅ Console logs confirming tracking

## 🚨 Common Issues

1. **"Umami not available" warning**: Script hasn't loaded yet, wait a moment
2. **API returns 0**: Events might not have been tracked yet, try downloading something
3. **CORS errors**: Shouldn't happen with server-side API route
4. **Events delayed**: Umami updates every 10-30 seconds, be patient

