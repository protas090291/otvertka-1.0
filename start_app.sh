#!/bin/bash

# Скрипт для запуска приложения
cd "$(dirname "$0")/Helper2"

echo "📦 Установка зависимостей frontend..."
npm install

echo "🚀 Запуск backend..."
cd backend
python3 simple_main.py &
BACKEND_PID=$!

echo "⏳ Ожидание запуска backend..."
sleep 3

echo "🚀 Запуск frontend..."
cd ..
npm run dev &
FRONTEND_PID=$!

echo "✅ Приложение запущено!"
echo "   Backend: http://localhost:8000"
echo "   Frontend: http://localhost:5173 (или 5175)"
echo ""
echo "Для остановки нажмите Ctrl+C"

wait
