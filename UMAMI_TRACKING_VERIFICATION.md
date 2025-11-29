# Umami Tracking Verification Guide

## ✅ Current Setup Status

### 1. **Tracking Script Configuration**
- **Location**: `app/layout.tsx`
- **Script URL**: `https://cloud.umami.is/script.js`
- **Website ID**: `5d7c0418-ad3d-43b6-be7e-b3ff326e86b7`
- **Status**: ✅ Configured with `defer` attribute
- **Verification**: Added script to log when Umami loads

### 2. **Event Tracking Implementation**
- **Location**: `app/components/VideoDownloader.tsx`
- **Events Tracked**:
  - ✅ "Download Video" - Tracked when video download completes
  - ✅ "Download Audio" - Tracked when audio download completes
- **Tracking Points**:
  - Line 397: Main download with progress tracking
  - Line 435: Fallback download tracking
  - Line 1013: Simple download button tracking

### 3. **Admin Panel Integration**
- **Location**: `app/admin/page.tsx`
- **API Endpoint**: `/api/admin/umami?type=all`
- **Data Fetched**:
  - Total pageviews
  - Video downloads (all-time and today)
  - Audio downloads (all-time and today)
  - Revenue calculation

### 4. **API Route**
- **Location**: `app/api/admin/umami/route.ts`
- **Functionality**:
  - Fetches events from Umami API
  - Parses pageviews (eventType: 1)
  - Parses custom events (eventType: 2)
  - Counts "Download Video" and "Download Audio" events
  - Handles pagination

## 🧪 How to Test

### Step 1: Verify Umami Script is Loaded

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Open your browser** and navigate to `http://localhost:3000`

3. **Open Developer Console** (F12)

4. **Check for Umami script**:
   - Type in console: `window.umami`
   - **Expected**: Should return a function, not `undefined`
   - **Also check**: Console should show `[Umami] Tracking script loaded successfully`

5. **Check Network Tab**:
   - Look for request to `https://cloud.umami.is/script.js`
   - Status should be 200 (success)

### Step 2: Test Pageview Tracking

1. **Open your site** in a new incognito/private window
2. **Navigate to the homepage**
3. **Check Umami Dashboard**:
   - Go to: `https://cloud.umami.is/share/SgUhlS4KYP3zIBI7`
   - You should see a new pageview appear within 10-30 seconds

### Step 3: Test Download Event Tracking

1. **On your site**, paste a video URL (e.g., YouTube, Instagram)
2. **Wait for video to scan**
3. **Click "Download Video" button**
4. **Wait for download to complete**
5. **Check Browser Console**:
   - Should see: `[VideoDownloader] Tracked Umami event: Download Video`
6. **Check Umami Dashboard**:
   - Go to Events section
   - Look for "Download Video" event
   - Count should increase

### Step 4: Test Audio Download Event

1. **Check the "Download audio only (MP3)" checkbox**
2. **Paste a video URL**
3. **Wait for video to scan**
4. **Click "Download" button**
5. **Wait for download to complete**
6. **Check Browser Console**:
   - Should see: `[VideoDownloader] Tracked Umami event: Download Audio`
7. **Check Umami Dashboard**:
   - Look for "Download Audio" event
   - Count should increase

### Step 5: Test Admin Panel

1. **Navigate to admin panel**:
   ```
   http://localhost:3000/admin?pw=kwiny191433
   ```

2. **Check Console Logs**:
   - Should see: `[Admin] All-time API response: {...}`
   - Should see: `[Admin] All-time stats parsed: { video: X, audio: Y, pageviews: Z }`
   - Should see: `[Admin] Today API response: {...}`

3. **Check UI Stats Cards**:
   - Total Downloads (video + audio)
   - Today's Downloads
   - Video Downloads (total and today)
   - Audio Downloads (total and today)
   - Revenue calculation

4. **Check Analytics iframe**:
   - Should display Umami dashboard embedded

### Step 6: Test API Route Directly

1. **Test the main API endpoint**:
   ```
   http://localhost:3000/api/admin/umami?type=all
   ```
   
   **Expected Response**:
   ```json
   {
     "pageviews": 123,
     "videoDownloads": 45,
     "audioDownloads": 12,
     "events": [...]
   }
   ```

2. **Test the verification endpoint**:
   ```
   http://localhost:3000/api/admin/umami/test
   ```
   
   **Expected Response**:
   ```json
   {
     "timestamp": "2024-...",
     "status": "success",
     "checks": {
       "env": {
         "apiKey": "api_pNOGm...",
         "websiteId": "5d7c0418-ad3d-43b6-be7e-b3ff326e86b7",
         "apiKeySet": true
       },
       "api": {
         "status": 200,
         "ok": true,
         "data": {
           "totalEvents": 100,
           "pageviews": 50,
           "videoDownloads": 30,
           "audioDownloads": 20
         }
       }
     }
   }
   ```

## 🔍 Troubleshooting

### Issue: Umami script not loading

**Symptoms**:
- `window.umami` is `undefined`
- Console shows: `[Umami] Tracking script failed to load after 2 seconds`

**Solutions**:
1. Check browser console for errors
2. Check Network tab - is `script.js` loading?
3. Check if ad blockers are blocking the script
4. Verify the script URL is correct: `https://cloud.umami.is/script.js`

### Issue: Events not showing in Umami

**Symptoms**:
- Console shows: `[VideoDownloader] Tracked Umami event: Download Video`
- But events don't appear in Umami dashboard

**Solutions**:
1. **Wait 10-30 seconds** - Umami updates are not instant
2. Check browser console for errors when tracking
3. Verify `window.umami` exists before tracking
4. Check Network tab for requests to `cloud.umami.is`
5. Verify website ID matches: `5d7c0418-ad3d-43b6-be7e-b3ff326e86b7`

### Issue: Admin panel shows 0 downloads

**Symptoms**:
- Admin panel displays all zeros
- API returns empty data

**Solutions**:
1. **Check environment variables**:
   - `UMAMI_API_KEY` must be set
   - Restart dev server after setting env vars
   
2. **Test API endpoint directly**:
   ```
   http://localhost:3000/api/admin/umami/test
   ```
   Check the response for errors

3. **Check server logs**:
   - Look for `[Umami API]` log messages
   - Check for API errors or authentication failures

4. **Verify API key**:
   - Make sure `UMAMI_API_KEY` is valid
   - Check if it has access to the website ID

5. **Check API base URL**:
   - Default: `https://api.umami.is/v1`
   - Verify this is correct for your Umami instance

### Issue: Events tracked but not counted correctly

**Symptoms**:
- Events appear in Umami dashboard
- But admin panel shows wrong counts

**Solutions**:
1. **Check event names**:
   - Must be exactly: "Download Video" or "Download Audio"
   - Case-sensitive!

2. **Check API parsing**:
   - Look at server logs: `[Umami API] Found custom event: ...`
   - Verify event structure matches expected format

3. **Check pagination**:
   - API route handles pagination automatically
   - But if you have many events, verify all pages are fetched

## 📊 Expected Results

After successful setup, you should see:

✅ **Browser Console**:
- `[Umami] Tracking script loaded successfully`
- `[VideoDownloader] Tracked Umami event: Download Video` (when downloading)
- `[VideoDownloader] Tracked Umami event: Download Audio` (when downloading audio)

✅ **Umami Dashboard** (`https://cloud.umami.is/share/SgUhlS4KYP3zIBI7`):
- Pageviews increasing
- "Download Video" events in Events section
- "Download Audio" events in Events section

✅ **Admin Panel** (`/admin?pw=kwiny191433`):
- Total Downloads count
- Today's Downloads count
- Video/Audio breakdowns
- Revenue calculation

✅ **API Endpoint** (`/api/admin/umami?type=all`):
- Returns JSON with pageviews, videoDownloads, audioDownloads
- Includes events array

## 🔧 Configuration Files

### Environment Variables Required

Create or update `.env.local` (or `.env`):

```env
UMAMI_API_KEY=your_api_key_here
UMAMI_WEBSITE_ID=5d7c0418-ad3d-43b6-be7e-b3ff326e86b7
UMAMI_API_BASE_URL=https://api.umami.is/v1
```

**Important**: Restart your dev server after updating environment variables!

## 📝 Summary

The tracking system is fully configured:

1. ✅ Umami script loads in `app/layout.tsx`
2. ✅ Download events are tracked in `VideoDownloader.tsx`
3. ✅ Admin panel fetches stats from `/api/admin/umami`
4. ✅ API route parses and counts events correctly
5. ✅ Verification endpoint available at `/api/admin/umami/test`

To verify everything is working:
1. Check browser console for Umami loading
2. Perform a test download
3. Check Umami dashboard for events
4. Check admin panel for stats
5. Test API endpoint directly

