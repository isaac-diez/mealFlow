# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Stage 2: Runtime ---
FROM node:20-alpine
WORKDIR /app
# Copy the compiled frontend and backend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
# Install only production dependencies
RUN npm install --omit=dev

ENV NODE_ENV=production
EXPOSE 3000

# Matches the 'start' script in your package.json
CMD ["npm", "start"]