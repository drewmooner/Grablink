# Server Requirements for Grablink

## System Dependencies

### Required (Must Install)

1. **Python 3.8+**
   - Required for yt-dlp (video extraction)
   - Install: `apt-get install python3` (Ubuntu/Debian) or `brew install python3` (macOS)
   - Verify: `python3 --version`

2. **yt-dlp (Python Package)**
   - Video extraction tool (supports TikTok, Instagram, YouTube, etc.)
   - Install: `pip3 install yt-dlp` or `pip install yt-dlp`
   - Verify: `yt-dlp --version`
   - Update regularly: `pip3 install -U yt-dlp`

3. **FFmpeg**
   - Audio extraction and video processing
   - Install: 
     - Ubuntu/Debian: `apt-get install ffmpeg`
     - macOS: `brew install ffmpeg`
     - Windows: Download from https://ffmpeg.org
   - Verify: `ffmpeg -version`
   - Note: @ffmpeg-installer/ffmpeg provides binary, but system install is recommended

### Optional (Recommended)

4. **browser_cookie3 (Python Package)**
   - Enables cookie extraction from browsers for better TikTok and Instagram support
   - Install: `pip3 install browser_cookie3` or `pip install browser_cookie3`
   - Note: This is optional - the app works without it, but TikTok extraction may be less reliable
   - On Windows: May require Chrome to be closed or additional permissions
   - Error "Could not copy Chrome cookie database" is non-fatal and can be ignored

5. **Node.js 18+**
   - Already have, but ensure version 18+
   - Verify: `node --version`

6. **Redis** (for rate limiting cache)
   - Optional but recommended for production
   - Install: `apt-get install redis` or `brew install redis`
   - Or use in-memory cache for development

## Environment Variables

Create `.env.local` file:

```env
# Optional: Redis for rate limiting (if using)
REDIS_URL=redis://localhost:6379

# Optional: Rate limit settings
RATE_LIMIT_PER_HOUR=20

# Optional: Video processing settings
MAX_VIDEO_SIZE_MB=100
VIDEO_PROCESSING_TIMEOUT=300000
```

## Deployment Considerations

### Vercel/Serverless
- ⚠️ **Limitations**: 
  - 10-second timeout on Hobby plan
  - 50-second timeout on Pro plan
  - May need Vercel Pro for video processing
  - Consider separate API server for video processing

### Self-Hosted/VPS
- ✅ **Recommended**: Full control, no timeout limits
- Install all system dependencies above
- Ensure sufficient disk space for temporary video files
- Consider cleanup job for temp files

### Docker
- Create Dockerfile with Python, FFmpeg, Node.js
- Use multi-stage build for smaller image

## File System

- **Temporary storage**: Videos downloaded temporarily during processing
- **Cleanup**: Implement cleanup job to remove temp files after 1 hour
- **Disk space**: Ensure at least 10GB free for temp files

## API Route Configuration

- Already configured in `next.config.ts`:
  - Body size limit: 50MB
  - Response limit: 50MB
  - Timeout: May need adjustment based on hosting

## Testing Checklist

- [ ] Python 3.8+ installed
- [ ] yt-dlp installed and working
- [ ] FFmpeg installed and working
- [ ] Can extract video from TikTok
- [ ] Can extract video from Instagram
- [ ] Can extract video from YouTube
- [ ] Audio extraction works
- [ ] Rate limiting works
- [ ] Temp file cleanup works

