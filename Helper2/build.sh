#!/bin/bash
# Скрипт сборки для TimeWeb Cloud
# Этот скрипт можно запускать из корня репозитория

set -e  # Остановить выполнение при ошибке

# Переходим в директорию проекта
cd "$(dirname "$0")" || exit 1

# Устанавливаем зависимости
echo "Installing dependencies..."
npm install

# Собираем проект
echo "Building project..."
npm run build

echo "Build completed successfully!"
echo "Output directory: $(pwd)/dist"
