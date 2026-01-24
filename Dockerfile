FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the app
RUN bun run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Start the app using the custom server with bun
CMD ["bun", "run", "server.js"]
