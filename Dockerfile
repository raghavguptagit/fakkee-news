FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .
RUN npm run train:ml && npm run build

# Ensure SQLite data directory exists for volume mounting
RUN mkdir -p /app/backend/data

ENV NODE_ENV=production
ENV PORT=3000
ENV SQLITE_DB_PATH=/app/backend/data/truthlens.db

EXPOSE 3000

CMD ["npm", "run", "start"]
