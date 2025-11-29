# Test Download Tracking - Step by Step Guide

## 🎯 Testing with Facebook Video: https://www.facebook.com/share/r/1Yycg8Y7Ht/

### Prerequisites
1. Make sure your dev server is running: `npm run dev`
2. Open your browser to: `http://localhost:3000`
3. Open Developer Console (F12) - keep it open during testing

---

## Test 1: Download Video and Verify Tracking

### Steps:
1. **Paste the video URL** in the input field:
   ```
   https://www.facebook.com/share/r/1Yycg8Y7Ht/
   ```

2. **Wait for video to scan** (you'll see video info appear)

3. **Open Browser Console** (F12) and look for:
   - `[Umami] Tracking script loaded successfully` ✅
   - Type: `window.umami` - should return a function ✅

4. **Click "Download Video" button**

5. **Watch the Console** - you should see:
   ```
   [VideoDownloader] Tracked Umami event: Download Video
   ```

6. **Wait for download to complete** (progress bar reaches 100%)

7. **Verify in Admin Panel**:
   - Go to: `http://localhost:3000/admin?pw=kwiny191433`
   - Wait 5-10 seconds for stats to refresh
   - Check "Video Downloads" count - should increase by 1
   - Check "Total Downloads" - should increase by 1

8. **Check Server Logs** - you should see:
   ```
   [Umami API] Found custom event: Download Video eventType: 2
   [Umami API] Final parsed counts: { pageviews: X, videoDownloads: 1, audioDownloads: 0 }
   ```

---

## Test 2: Download Audio and Verify Tracking

### Steps:
1. **Check the checkbox**: "Download audio only (MP3)"

2. **Paste the same video URL**:
   ```
   https://www.facebook.com/share/r/1Yycg8Y7Ht/
   ```

3. **Wait for video to scan**

4. **Click "Download" button**

5. **Watch the Console** - you should see:
   ```
   [VideoDownloader] Tracked Umami event: Download Audio
   ```

6. **Wait for download to complete**

7. **Verify in Admin Panel**:
   - Refresh admin panel or wait 5 seconds
   - Check "Audio Downloads" count - should increase by 1
   - Check "Total Downloads" - should increase by 1

8. **Check Server Logs** - you should see:
   ```
   [Umami API] Found custom event: Download Audio eventType: 2
   [Umami API] Final parsed counts: { pageviews: X, videoDownloads: 1, audioDownloads: 1 }
   ```

---

## ✅ Expected Results

### Browser Console Should Show:
```
[Umami] Tracking script loaded successfully
[VideoDownloader] Tracked Umami event: Download Video
[VideoDownloader] Tracked Umami event: Download Audio
```

### Admin Panel Should Show:
- **Total Downloads**: 2 (after both tests)
- **Video Downloads**: 1
- **Audio Downloads**: 1
- **Today**: Should show today's count

### Server Logs Should Show:
```
[Umami API] Events fetch successful, found X events (total: X)
[Umami API] Found custom event: Download Video eventType: 2
[Umami API] Found custom event: Download Audio eventType: 2
[Umami API] Final parsed counts: { pageviews: X, videoDownloads: 1, audioDownloads: 1 }
```

---

## 🔍 Troubleshooting

### If tracking doesn't work:

1. **Check Umami script loaded**:
   - Console: `window.umami` should return a function
   - If undefined, check Network tab for `script.js` loading

2. **Check console for errors**:
   - Look for any red error messages
   - Check if `[VideoDownloader] Tracked Umami event` appears

3. **Check server logs**:
   - Look for `[Umami API] Events fetch successful`
   - Check for `[Umami API] Found custom event`

4. **Wait for Umami to process**:
   - Events may take 10-30 seconds to appear in API
   - Refresh admin panel after waiting

5. **Verify API endpoint**:
   - Test: `http://localhost:3000/api/admin/umami/test`
   - Should return success status

---

## 📊 Real-time Monitoring

While testing, you can monitor in real-time:

1. **Browser Console**: Watch for tracking logs
2. **Server Logs**: Watch for API fetch and event parsing
3. **Admin Panel**: Auto-refreshes every 5 seconds
4. **Network Tab**: Check for requests to `cloud.umami.is`

---

## 🎉 Success Criteria

✅ Video download completes  
✅ Console shows: `[VideoDownloader] Tracked Umami event: Download Video`  
✅ Audio download completes  
✅ Console shows: `[VideoDownloader] Tracked Umami event: Download Audio`  
✅ Admin panel shows correct counts  
✅ Server logs show events being parsed  
✅ No 500 errors in server logs  

