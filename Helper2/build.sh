#!/bin/bash
# Скрипт сборки для TimeWeb Cloud с диагностикой
# Этот скрипт можно запускать из корня репозитория

set -e  # Остановить выполнение при ошибке

# ДИАГНОСТИКА: Показываем, где мы находимся
echo "=== ДИАГНОСТИКА ==="
echo "Текущая директория: $(pwd)"
echo "Путь к скрипту: $0"
echo "Директория скрипта: $(dirname "$0")"

# Переходим в директорию проекта
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Переходим в: $SCRIPT_DIR"
cd "$SCRIPT_DIR" || exit 1

echo "После перехода: $(pwd)"
echo "Проверка файлов:"
echo "  - index.html: $([ -f index.html ] && echo 'НАЙДЕН' || echo 'НЕ НАЙДЕН')"
echo "  - vite.config.ts: $([ -f vite.config.ts ] && echo 'НАЙДЕН' || echo 'НЕ НАЙДЕН')"
echo "  - package.json: $([ -f package.json ] && echo 'НАЙДЕН' || echo 'НЕ НАЙДЕН')"
echo "=================="
echo ""

# Устанавливаем зависимости
echo "Installing dependencies..."
npm install

# Собираем проект с явным указанием конфига
echo "Building project..."
npm run build

echo "Build completed successfully!"
echo "Output directory: $(pwd)/dist"
echo "Проверка результата:"
ls -la dist/ | head -5
