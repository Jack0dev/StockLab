# ============================================
# Stage 1: Build React app with Vite
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Cache npm dependencies first
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# Build args for API URL (injected at build time)
ARG VITE_API_URL
ARG VITE_WS_URL

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

# Copy source and build
COPY . .
RUN npm run build

# ============================================
# Stage 2: Serve with Nginx
# ============================================
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/stocklab.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Railway injects PORT env var — use envsubst to replace it in nginx config
# Default to port 80 if not set
ENV PORT=80

# Create a template and replace PORT at runtime
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'envsubst "\$PORT" < /etc/nginx/conf.d/stocklab.conf > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'rm /etc/nginx/conf.d/stocklab.conf' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

EXPOSE ${PORT}

CMD ["/docker-entrypoint.sh"]
