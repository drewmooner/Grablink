# Render Auto-Deploy Not Working - Fix Guide

## Problem
Auto-deploy is enabled but not triggering on commits.

## Solutions

### Solution 1: Reconnect GitHub Repository (Recommended)

1. Go to Render Dashboard → Your Service → Settings
2. Scroll to **Repository** section
3. Click **Disconnect** (if connected)
4. Click **Connect GitHub**
5. Re-select your repository
6. Make sure **Auto-Deploy** is ON
7. Save

### Solution 2: Check GitHub Webhook

1. Go to your GitHub repository
2. Settings → Webhooks
3. Look for a webhook to `render.com`
4. If missing, Render needs to recreate it (use Solution 1)

### Solution 3: Manual Trigger (Quick Fix)

Use the webhook URL to manually trigger:
```
https://api.render.com/deploy/srv-d59i6e0gjchc73aok2l0?key=RDfENBCN888
```

### Solution 4: Check Branch Settings

1. Render Dashboard → Your Service → Settings
2. **Branch**: Should be `main` (not `master` or other)
3. **Root Directory**: Should be `/` or empty
4. Save if changed

---

## Quick Test

After fixing, make a small commit and push:
```bash
git commit --allow-empty -m "Test: Trigger Render auto-deploy"
git push origin main
```

Then check Render dashboard for new deployment.

