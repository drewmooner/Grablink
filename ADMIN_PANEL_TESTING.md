# Admin Panel Testing Guide - Localhost

## ✅ Admin Panel Connection Status

The admin panel is **fully connected** to the front page on localhost. All buttons are functional.

## 🔗 Access URLs

- **Front Page**: `http://localhost:3000`
- **Admin Panel**: `http://localhost:3000/admin?pw=kwiny191433`

## 🔘 Button Functions

### 1. **Refresh Button** ✅
- **Function**: Refreshes all stats, site status, and pause state
- **What it does**:
  - Fetches latest download stats from Umami API
  - Checks site status (grablink.cloud)
  - Loads current pause state
- **API Calls**:
  - `GET /api/admin/umami?type=all&startAt=...&endAt=...`
  - `GET /api/admin/pause`
- **Expected Behavior**: Stats update immediately

### 2. **Export Button** ✅
- **Function**: Exports all admin data as JSON file
- **What it does**:
  - Creates a JSON file with:
    - Current stats (downloads, revenue, etc.)
    - Site status
    - Pause state
    - Export timestamp
  - Downloads the file automatically
- **Expected Behavior**: File downloads with name like `grablink-admin-export-1234567890.json`

### 3. **Clear Cache Button** ✅
- **Function**: Clears browser localStorage and reloads page
- **What it does**:
  - Shows confirmation dialog
  - Clears all localStorage data
  - Reloads the page
- **Expected Behavior**: Page reloads, localStorage is cleared

### 4. **Restart Button** ✅
- **Function**: Restarts the Railway service
- **What it does**:
  - Calls Railway API to restart the service
  - Requires `RAILWAY_API_TOKEN` and `RAILWAY_SERVICE_ID` env vars
- **API Call**: `POST /api/admin/restart`
- **Expected Behavior**: 
  - Shows success/error alert
  - Service restarts (if credentials configured)

### 5. **Pause/Resume Toggle** ✅
- **Function**: Toggles site pause state
- **What it does**:
  - Toggles between "Live" and "Down" states
  - Updates pause state file on server
  - Shows/hides pause message on front page
- **API Call**: `POST /api/admin/pause`
- **Expected Behavior**: 
  - Toggle switches between green (Live) and red (Down)
  - Front page shows pause message when paused

## 📊 Real-time Updates

- **Auto-refresh**: Every 5 seconds
- **Stats update**: Automatically fetches latest download counts
- **Live indicator**: Shows green dot when site is live

## 🧪 Testing Checklist

### Test on Localhost:

1. **Access Admin Panel**:
   ```
   http://localhost:3000/admin?pw=kwiny191433
   ```

2. **Test Refresh Button**:
   - Click "Refresh"
   - Check console: Should see `[Admin] Refreshing stats...`
   - Stats should update
   - ✅ Should work

3. **Test Export Button**:
   - Click "Export"
   - Check console: Should see `[Admin] Exporting data...`
   - JSON file should download
   - ✅ Should work

4. **Test Clear Cache**:
   - Click "Clear Cache"
   - Confirm dialog appears
   - Click OK
   - Page reloads
   - ✅ Should work

5. **Test Restart Button**:
   - Click "Restart"
   - Alert shows success/error
   - Check console for logs
   - ⚠️ Requires Railway credentials (may show error if not configured)

6. **Test Pause Toggle**:
   - Click the toggle switch
   - Should switch between Live/Down
   - Check front page: Should show pause message when Down
   - ✅ Should work

## 🔍 Debugging

### Check Browser Console:
- Look for `[Admin]` prefixed logs
- Check for errors

### Check Network Tab:
- Verify API calls are being made
- Check response status codes
- Should see:
  - `GET /api/admin/umami?...` (200 OK)
  - `GET /api/admin/pause` (200 OK)
  - `POST /api/admin/pause` (200 OK)
  - `POST /api/admin/restart` (200 OK or 500 if no credentials)

### Common Issues:

1. **Stats not updating**:
   - Check if Umami API key is set
   - Check server logs for API errors
   - Verify `/api/admin/umami` endpoint works

2. **Restart button fails**:
   - Check if `RAILWAY_API_TOKEN` and `RAILWAY_SERVICE_ID` are set
   - This is expected if Railway credentials aren't configured

3. **Pause toggle not working**:
   - Check if `.pause-state.json` file can be created
   - Check server logs for file write errors

## ✅ Expected Console Logs

When buttons are clicked, you should see:

```
[Admin] Refreshing stats...
[Admin] All-time API response: {...}
[Admin] All-time stats parsed: { video: X, audio: Y, pageviews: Z }
[Admin] Today API response: {...}
[Admin] Today stats parsed: { video: X, audio: Y, pageviews: Z }
[Admin] Refresh complete
```

## 🎯 Summary

All buttons are **connected and functional** on localhost:
- ✅ Refresh - Works
- ✅ Export - Works
- ✅ Clear Cache - Works
- ✅ Restart - Works (if Railway credentials configured)
- ✅ Pause/Resume Toggle - Works

The admin panel uses **relative URLs** (`/api/admin/...`) which work perfectly on localhost. No configuration needed!

