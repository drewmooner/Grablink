# 🤖 UptimeRobot Setup Guide

## ✅ **Quick Setup Checklist**

### **1. Monitor URL** ✅
```
https://grablink.onrender.com/api/health
```
**Important:** Use the `/api/health` endpoint, NOT the homepage!

---

### **2. Monitor Settings**

| Setting | Value | Why |
|---------|-------|-----|
| **Monitor Type** | `HTTP(s)` | Standard web monitoring |
| **Friendly Name** | `Grablink Backend Health` | Easy to identify |
| **URL** | `https://grablink.onrender.com/api/health` | Health check endpoint |
| **Monitoring Interval** | `5 minutes` | Free tier minimum (keeps service awake) |
| **Timeout** | `30 seconds` | Default is fine |
| **Status** | `Active` ✅ | Must be enabled |

---

### **3. Advanced Settings (Optional but Recommended)**

#### **Alert Contacts**
- Add your email address
- You'll get notified if the service goes down
- Free tier: Up to 50 email alerts/month

#### **Alert When**
- ✅ **Down** - Service is unreachable
- ✅ **Up** - Service recovers (optional)

---

### **4. Expected Response**

**Success Response (200 OK):**
```json
{
  "status": "healthy",
  "checks": {
    "python": { "available": true, "version": "Python 3.x.x" },
    "ytdlp": { "available": true, "version": "2024.x.x" },
    "ffmpeg": { "available": true, "version": "x.x.x" }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**If you see this, it's working! ✅**

---

## 🎯 **What This Does**

1. **Pings every 5 minutes** → Keeps Render backend awake
2. **Prevents cold starts** → No 30-60 second delays
3. **Monitors health** → Alerts you if service goes down
4. **Free forever** → No cost for basic monitoring

---

## ⚠️ **Common Mistakes**

### ❌ **Wrong URL:**
```
https://grablink.onrender.com          ← Homepage (won't work well)
https://grablink.onrender.com/         ← Homepage (won't work well)
```

### ✅ **Correct URL:**
```
https://grablink.onrender.com/api/health  ← Health endpoint (correct!)
```

---

### ❌ **Wrong Interval:**
```
30 minutes  ← Too long, service will sleep
1 hour      ← Way too long
```

### ✅ **Correct Interval:**
```
5 minutes   ← Perfect! Keeps service awake
```

---

## 🔍 **How to Verify It's Working**

1. **Check UptimeRobot Dashboard:**
   - Status should show "Up" ✅
   - Last check should be recent (within 5 minutes)

2. **Check Render Logs:**
   - You should see GET requests to `/api/health` every 5 minutes
   - No more cold starts!

3. **Test Your App:**
   - Video fetch should be fast (no 30-60s delay)
   - First request should respond immediately

---

## 📊 **Free Tier Limits**

- ✅ **50 monitors** (you only need 1)
- ✅ **5-minute intervals** (perfect for keeping service awake)
- ✅ **50 email alerts/month** (plenty for monitoring)
- ✅ **2 months of logs** (good for debugging)

**You don't need to upgrade! Free tier is perfect for this use case.**

---

## 🚀 **After Setup**

1. **Wait 5 minutes** for first check
2. **Verify status** shows "Up" in UptimeRobot
3. **Test your app** - should be fast now!
4. **Check Render logs** - should see regular health checks

---

## ❓ **Troubleshooting**

### **Status shows "Down"**
- Check if Render backend is actually running
- Verify URL is correct: `/api/health` (not homepage)
- Check Render logs for errors

### **Still seeing cold starts**
- Verify monitoring interval is 5 minutes (not longer)
- Check UptimeRobot is actually pinging (check logs)
- Wait a few minutes for first ping to happen

### **Not receiving alerts**
- Check spam folder
- Verify email in alert contacts
- Check alert settings are enabled

---

## ✅ **Final Checklist**

- [ ] URL is `https://grablink.onrender.com/api/health`
- [ ] Monitor type is `HTTP(s)`
- [ ] Interval is `5 minutes`
- [ ] Status is `Active` ✅
- [ ] Alert contacts added (optional)
- [ ] Monitor is showing "Up" status

**Once all checked, you're done! 🎉**

