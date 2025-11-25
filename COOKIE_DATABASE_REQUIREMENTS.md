# Requirements to Read Chrome Cookie Database

## Current Status Check

✅ **browser_cookie3**: Installed  
✅ **Python**: 3.11.9 installed  
✅ **Chrome**: Closed (can access database)  
⚠️ **DPAPI Decryption**: May fail on Windows (non-fatal, app continues without cookies)

## Requirements to Read Chrome Cookie Database

### 1. **Python Package: browser_cookie3** ✅
- **Status**: Installed
- **Purpose**: Python library that yt-dlp uses to extract cookies from Chrome
- **Installation**: `pip install browser_cookie3`
- **Verify**: `python -c "import browser_cookie3; print('OK')"`

### 2. **Chrome Must Be Closed** ❌ (Currently blocking)
- **Why**: Chrome locks its cookie database file when running
- **Location**: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cookies`
- **Solution**: Close ALL Chrome windows and processes
- **Check**: `tasklist /FI "IMAGENAME eq chrome.exe"` (should return empty)

### 3. **File System Permissions**
- **Required**: Read access to Chrome's profile directory
- **Path**: `C:\Users\[USERNAME]\AppData\Local\Google\Chrome\User Data\Default\`
- **Files needed**:
  - `Cookies` (SQLite database)
  - `Local State` (contains encryption key)
- **Windows**: Usually works without admin, but may need it if:
  - Chrome was installed for another user
  - Profile is in a protected location

### 4. **Chrome Profile Access**
- **Default Profile**: Usually `Default` or `Profile 1`
- **Multiple Profiles**: yt-dlp uses the default profile automatically
- **Custom Profile**: Can specify with `--cookies-from-browser "chrome:ProfileName"`

### 5. **yt-dlp Version**
- **Required**: Recent version with cookie support
- **Check**: `yt-dlp --version`
- **Update**: `pip install -U yt-dlp`

## How It Works

1. **yt-dlp** calls `--cookies-from-browser chrome`
2. **browser_cookie3** Python library is invoked
3. **browser_cookie3** reads Chrome's SQLite cookie database
4. **browser_cookie3** decrypts cookies using Chrome's encryption key
5. **yt-dlp** uses cookies in HTTP requests to TikTok

## Windows-Specific Issues

### DPAPI Decryption Error
**Error**: `Failed to decrypt with DPAPI`

**Cause**: Windows Data Protection API (DPAPI) can't decrypt Chrome cookies. This happens when:
- Cookies were encrypted by a different Windows user account
- Running in a different user context (e.g., service account)
- Windows encryption keys are not accessible

**Solutions**:
1. **Run as the same user who uses Chrome** (most common fix)
2. **Manual cookie export**: Use browser extension to export cookies
3. **Use Firefox instead**: `--cookies-from-browser firefox` (often works better on Windows)

## Troubleshooting Steps

### Step 1: Close Chrome Completely
```powershell
# Kill all Chrome processes
taskkill /F /IM chrome.exe
```

### Step 2: Verify Chrome is Closed
```powershell
tasklist /FI "IMAGENAME eq chrome.exe"
# Should return: "INFO: No tasks are running..."
```

### Step 3: Try Again
- Run your Next.js server
- Try extracting a TikTok video
- Check logs for cookie extraction success

### Step 4: If Still Fails - Check Permissions
```powershell
# Check if you can access Chrome profile
dir "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cookies"
```

### Step 5: If Still Fails - Run as Administrator
- Right-click PowerShell/Command Prompt
- Select "Run as administrator"
- Navigate to project directory
- Run `npm run dev` or `npm start`

## Alternative Solutions

### Option 1: Use Firefox Instead (Often Works Better on Windows)
Firefox cookie extraction is more reliable on Windows:
- Change code to use: `--cookies-from-browser firefox`
- Firefox doesn't have the same DPAPI issues as Chrome on Windows
- **Note**: Requires Firefox to be installed and closed

### Option 2: Manual Cookie Export
If automatic extraction doesn't work:

1. **Install Browser Extension**: "Get cookies.txt" or "Cookie-Editor"
2. **Export Cookies**: Export TikTok cookies to `cookies.txt`
3. **Use with yt-dlp**: `yt-dlp --cookies cookies.txt [URL]`

### Option 3: Continue Without Cookies
- The app will work without cookies (just less reliable for TikTok)
- TikTok may rate-limit or block requests more often
- But extraction will still work for most videos
- **Current behavior**: App continues even if cookie extraction fails

## Why Cookies Are Important for TikTok

- **Authentication**: TikTok checks for valid session cookies
- **Rate Limiting**: Without cookies, TikTok may block requests faster
- **Bot Detection**: Cookies make requests look like real browser traffic
- **Success Rate**: Higher success rate with cookies vs without

## Current Error Explanation

**"Could not copy cookie database"** means:
- yt-dlp tried to access Chrome's cookie database
- The database file is locked (Chrome is running)
- OR file permissions prevent access
- **Result**: Extraction continues WITHOUT cookies (less reliable)

## Quick Fix

**Right now, to enable cookie reading:**
1. Close all Chrome windows
2. Open Task Manager (Ctrl+Shift+Esc)
3. End all `chrome.exe` processes
4. Restart your Next.js server
5. Try TikTok extraction again

