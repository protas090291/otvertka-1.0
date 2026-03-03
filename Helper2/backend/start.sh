#!/bin/bash
# Скрипт запуска для TimeWeb Cloud
# Убеждаемся, что мы в правильной директории

# Получаем абсолютный путь к директории скрипта
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "Текущая директория: $(pwd)"
echo "Проверка файлов:"
ls -la main_timeweb.py yandex_disk_api.py 2>&1 || echo "Файлы не найдены!"

# Устанавливаем PYTHONPATH для поиска модулей
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# Запускаем приложение
python -m uvicorn main_timeweb:app --host 0.0.0.0 --port 8000
