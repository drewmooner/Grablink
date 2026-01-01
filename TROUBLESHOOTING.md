# 🔧 Troubleshooting: Application Error & Video Fetch Issues

## ✅ **Fixes Applied**

### **1. Enhanced Error Handling** ✅
- Added response status checking before parsing JSON
- Added content-type validation
- Better error messages for debugging
- Console logging for API calls

### **2. Improved Error Messages** ✅
- More descriptive error messages
- Logs API URL being called
- Logs response status and errors

---

## 🐛 **Common Issues & Solutions**

### **Issue 1: "Application Error"**
**Possible Causes:**
- API endpoint not responding
- CORS issues
- Network connectivity problems
- Render backend is down/sleeping

**Solutions:**
1. Check browser console for errors
2. Verify Render backend is running: `https://grablink.onrender.com/api/health`
3. Check network tab for failed requests
4. Verify API URL is correct (should be `https://grablink.onrender.com` in production)

---

### **Issue 2: Video Fetch Not Happening**
**Possible Causes:**
- `getApiBaseUrl()` returning wrong URL
- Fetch request failing silently
- Response not being parsed correctly
- API endpoint returning non-JSON response

**Solutions:**
1. Check browser console for:
   - `[VideoDownloader] Fetching video info from: ...`
   - `[VideoDownloader] Request failed: ...`
   - `[VideoDownloader] API response not OK: ...`

2. Verify API base URL:
   - Production: Should use `https://grablink.onrender.com`
   - Localhost: Should use relative URLs (empty string)

3. Test API directly:
   ```bash
   curl -X POST https://grablink.onrender.com/api/video/info \
     -H "Content-Type: application/json" \
     -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
   ```

---

## 🔍 **Debugging Steps**

### **Step 1: Check Browser Console**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors starting with `[VideoDownloader]`
4. Check Network tab for failed requests

### **Step 2: Verify API Endpoint**
1. Check if Render backend is accessible:
   - Visit: `https://grablink.onrender.com/api/health`
   - Should return JSON with Python/yt-dlp status

2. Check if API route exists:
   - Visit: `https://grablink.onrender.com/api/video/info`
   - Should return error (needs POST with body)

### **Step 3: Test Locally**
1. Run `npm run dev`
2. Test with a video URL
3. Check console logs
4. Verify API calls are working

### **Step 4: Check Render Logs**
1. Go to Render dashboard
2. Check service logs
3. Look for errors or timeouts
4. Verify service is not sleeping

---

## 📝 **Error Messages Reference**

| Error Message | Meaning | Solution |
|--------------|---------|----------|
| `Network error: ...` | Fetch request failed | Check network, verify API URL |
| `Server error: 500 ...` | Server-side error | Check Render logs |
| `Server error: 404 ...` | Endpoint not found | Verify API route exists |
| `Invalid response from server` | Response not JSON | Check API response format |
| `Failed to scan video` | Video extraction failed | Check yt-dlp installation |

---

## 🚀 **Quick Fixes**

### **If Render Backend is Sleeping:**
- First request will take 30-60 seconds (cold start)
- Subsequent requests will be fast
- Use UptimeRobot to keep it awake

### **If CORS Errors:**
- Check API route has CORS headers
- Verify `Access-Control-Allow-Origin: *` is set

### **If Timeout Errors:**
- Video extraction can take 10-15 seconds
- Check Render logs for timeout errors
- Verify yt-dlp is working correctly

---

## ✅ **What Was Fixed**

1. ✅ Added response status checking
2. ✅ Added content-type validation
3. ✅ Better error logging
4. ✅ More descriptive error messages
5. ✅ Console logging for debugging

**Status**: ✅ **FIXED - Ready to test**


