FROM node:20-bullseye

# Update apt and install system dependencies required by Playwright
# (Just in case the base image lacks some libraries, but playwright install should handle it)
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.jsons first for caching
COPY package*.json ./
COPY src/client/package*.json ./src/client/

# Install all dependencies
RUN npm install
RUN cd src/client && npm install

# Install Playwright Chromium with system dependencies
RUN npx playwright install --with-deps chromium

# Copy the rest of the application
COPY . .

# Launch both servers
# Vite needs to bind to 0.0.0.0 and listen on the Render provided $PORT
# Express is forced to run on 3001 so Vite's proxy can find it
CMD ["sh", "-c", "env PORT=3001 node src/server/app.js & npm run dev --prefix src/client -- --host 0.0.0.0 --port ${PORT:-10000}"]
