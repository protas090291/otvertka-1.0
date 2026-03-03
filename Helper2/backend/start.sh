#!/bin/bash
# Скрипт запуска для TimeWeb Cloud
# Убеждаемся, что мы в правильной директории
cd "$(dirname "$0")" || exit 1

# Запускаем приложение
python -m uvicorn main_timeweb:app --host 0.0.0.0 --port 8000
