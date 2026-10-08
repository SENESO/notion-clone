FROM php:8.2-cli

# PostgreSQL driver + tooling
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev unzip git \
    && docker-php-ext-install pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install PHP dependencies first for better layer caching
COPY composer.json composer.lock* ./
RUN composer install --no-interaction --optimize-autoloader

COPY . .

EXPOSE 8000 8080

# API (port 8000) + real-time WebSocket server (port 8080)
CMD ["sh", "-c", "php bin/websocket-server.php & php -S 0.0.0.0:8000 -t public"]
