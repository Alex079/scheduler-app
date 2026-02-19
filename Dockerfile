FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY src/client/package.json src/client/package.json

# Install dependencies (including client dependencies via postinstall)
RUN npm ci

# Copy source code
COPY . .

# Build the React frontend
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the Express server
CMD ["npm", "start"]
