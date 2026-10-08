FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json* bun.lock* ./
RUN npm install

COPY . .

EXPOSE 3000

# Vite dev server (package.json "dev" script binds 0.0.0.0)
CMD ["npm", "run", "dev"]
