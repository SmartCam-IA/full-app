# Base Node image with Debian so we can install ffmpeg
FROM node:20-bookworm-slim

# Install ffmpeg (with libx264)
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# App dir
WORKDIR /app

# Install deps first
COPY package.json ./
RUN npm install --only=production

# Copy app
COPY server.js ./
COPY public ./public
# images are mounted as a volume at runtime
RUN mkdir -p /app/images

EXPOSE 3000 8554
ENV PORT=3000
ENV RTSP_PORT=8554

CMD ["node", "server.js"]
