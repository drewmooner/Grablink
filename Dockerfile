# Use Node.js 20 base image
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp (using --break-system-packages is safe in Docker containers)
RUN pip3 install --upgrade pip --break-system-packages && \
    pip3 install yt-dlp --break-system-packages && \
    yt-dlp --version && \
    which yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all Node.js dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application files
COPY . .

# Build the Next.js application
RUN npm run build

# Prune devDependencies to reduce image size (optional but recommended)
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

