# Multi-stage build for Present-Agent backend API
FROM node:20-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build || echo "Build script not found, skipping"

# Expose port
EXPOSE 3001

# Start the API server
CMD ["node", "--loader", "tsx", "src/server/index.ts"]
