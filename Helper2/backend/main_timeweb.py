"""
Простой FastAPI сервер для Яндекс Диска
Готов к деплою на TimeWeb
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import os
from dotenv import load_dotenv
from typing import Optional, Any
import sys
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Загружаем переменные окружения перед импортом yandex_disk_api
# В TimeWeb переменные окружения устанавливаются через панель, .env файл не обязателен
try:
    load_dotenv(override=False)
except Exception as e:
    logger.warning(f"Не удалось загрузить .env файл: {e}. Используются переменные окружения из системы.")

# Проверяем наличие токена при старте (но не падаем, если его нет)
token = os.getenv('YANDEX_DISK_TOKEN')
public_key = os.getenv('YANDEX_DISK_PUBLIC_KEY')
if not token and not public_key:
    logger.warning("⚠️ YANDEX_DISK_TOKEN и YANDEX_DISK_PUBLIC_KEY не установлены. API Яндекс Диска может не работать.")
elif token:
    logger.info("✅ YANDEX_DISK_TOKEN установлен")
elif public_key:
    logger.info("✅ YANDEX_DISK_PUBLIC_KEY установлен")

# Импортируем модуль yandex_disk_api с обработкой ошибок
# Делаем импорт безопасным, чтобы приложение могло запуститься даже при ошибках
yandex_disk_api_available = False
try:
    from yandex_disk_api import (
        get_folder_contents,
        get_public_download_link,
        get_public_view_link,
        get_download_link,
        download_file,
        get_yandex_disk_public_key,
        get_yandex_disk_token
    )
    yandex_disk_api_available = True
    logger.info("✅ Модуль yandex_disk_api успешно импортирован")
except ImportError as e:
    logger.error(f"❌ Ошибка импорта yandex_disk_api: {e}")
    logger.error("Проверьте, что файл yandex_disk_api.py существует в директории backend")
    logger.warning("⚠️ Приложение запустится, но API Яндекс Диска будет недоступно")
except Exception as e:
    logger.error(f"❌ Ошибка при загрузке модуля yandex_disk_api: {e}")
    logger.warning("⚠️ Приложение запустится, но API Яндекс Диска будет недоступно")

app = FastAPI(title="Yandex Disk API Proxy")

logger.info("🚀 FastAPI приложение инициализировано")

# CORS для работы с фронтендом
# В продакшене можно указать конкретные домены через переменную окружения ALLOWED_ORIGINS
# Формат: "https://домен1.ru,https://домен2.ru" или "*" для всех
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = allowed_origins_str.split(",") if allowed_origins_str != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

def format_file_size(bytes: int) -> str:
    """Форматирует размер файла в читаемый вид"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024.0:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024.0
    return f"{bytes:.1f} TB"

def format_date(date_string: str) -> str:
    """Форматирует дату в читаемый вид"""
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
        return dt.strftime('%d.%m.%Y %H:%M')
    except:
        return date_string

@app.get("/")
async def root():
    """Проверка работы сервера"""
    return {
        "status": "ok",
        "service": "Yandex Disk API Proxy",
        "version": "1.0.0"
    }

@app.get("/api/yandex-disk/files")
async def get_yandex_disk_files(folder_path: Optional[str] = Query(None)):
    """
    Получить список файлов из папки на Яндекс Диске
    
    Args:
        folder_path: Путь к папке (опционально, если не указан - корень)
    
    Returns:
        Список файлов и папок
    """
    if not yandex_disk_api_available:
        raise HTTPException(status_code=503, detail="Модуль yandex_disk_api недоступен. Проверьте логи приложения.")
    try:
        # Нормализуем путь: убираем префикс "disk:" если есть
        if folder_path and folder_path.startswith('disk:'):
            folder_path = folder_path[5:]
        
        # Если folder_path пустой или None, используем корень '/'
        if not folder_path or folder_path == '':
            folder_path = '/'
        
        # Получаем файлы
        files = get_folder_contents(folder_path)
        
        # Проверяем, используется ли OAuth токен или публичный ключ
        token = get_yandex_disk_token()
        public_key = get_yandex_disk_public_key()
        is_public = public_key is not None and token is None
        
        # Форматируем данные для frontend
        formatted_files = []
        for file in files:
            formatted_file = {
                'name': file['name'],
                'path': file['path'],
                'type': file['type'],
                'size': file['size'],
                'size_formatted': format_file_size(file['size']),
                'modified': file['modified'],
                'modified_formatted': format_date(file['modified']) if file['modified'] else '',
                'created': file['created'],
                'created_formatted': format_date(file['created']) if file['created'] else '',
                'mime_type': file['mime_type'],
                'preview': file.get('preview', ''),
                'public_url': file.get('public_url', ''),
                'public_key': file.get('public_key') or public_key
            }
            formatted_files.append(formatted_file)
        
        return {
            'files': formatted_files,
            'total': len(formatted_files),
            'folder_path': folder_path or '/',
            'is_public': public_key is not None,
            'public_key': public_key
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения файлов: {str(e)}")

@app.get("/api/yandex-disk/download-link")
async def get_download_link_endpoint(file_path: str = Query(...)):
    """
    Получить ссылку для скачивания файла
    
    Args:
        file_path: Путь к файлу
    
    Returns:
        Ссылка для скачивания
    """
    if not yandex_disk_api_available:
        raise HTTPException(status_code=503, detail="Модуль yandex_disk_api недоступен. Проверьте логи приложения.")
    try:
        # Нормализуем путь: убираем префикс "disk:" если есть
        if file_path.startswith('disk:'):
            file_path = file_path[5:]
        
        # Используем универсальную функцию get_download_link
        # Она автоматически определит, использовать OAuth токен или публичный ключ
        download_url = get_download_link(file_path)
        return {'download_url': download_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения ссылки: {str(e)}")

@app.get("/api/yandex-disk/view")
async def view_file(file_path: str = Query(...)):
    """
    Прокси для просмотра файла - скачивает файл и отдает его напрямую
    Это позволяет обойти CSP ограничения Яндекс Диска при открытии в iframe
    
    Args:
        file_path: Путь к файлу
    
    Returns:
        Содержимое файла с правильными заголовками
    """
    if not yandex_disk_api_available:
        raise HTTPException(status_code=503, detail="Модуль yandex_disk_api недоступен. Проверьте логи приложения.")
    try:
        # Нормализуем путь: убираем префикс "disk:" если есть
        if file_path.startswith('disk:'):
            file_path = file_path[5:]
        
        # Получаем публичный ключ, если используется публичная папка
        public_key = get_yandex_disk_public_key()
        
        # Скачиваем файл
        file_content = download_file(file_path, public_key=public_key)
        
        # Извлекаем имя файла из пути
        file_name = os.path.basename(file_path)
        
        # Определяем MIME тип по расширению
        mime_type = 'application/octet-stream'
        file_lower = file_name.lower()
        
        if file_lower.endswith('.pdf'):
            mime_type = 'application/pdf'
        elif file_lower.endswith(('.jpg', '.jpeg')):
            mime_type = 'image/jpeg'
        elif file_lower.endswith('.png'):
            mime_type = 'image/png'
        elif file_lower.endswith('.gif'):
            mime_type = 'image/gif'
        elif file_lower.endswith('.webp'):
            mime_type = 'image/webp'
        elif file_lower.endswith(('.mp4', '.m4v')):
            mime_type = 'video/mp4'
        elif file_lower.endswith('.webm'):
            mime_type = 'video/webm'
        elif file_lower.endswith(('.doc', '.docx')):
            mime_type = 'application/msword'
        elif file_lower.endswith(('.xls', '.xlsx')):
            mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        elif file_lower.endswith(('.ppt', '.pptx')):
            mime_type = 'application/vnd.ms-powerpoint'
        elif file_lower.endswith('.txt'):
            mime_type = 'text/plain'
        elif file_lower.endswith('.html'):
            mime_type = 'text/html'
        elif file_lower.endswith('.css'):
            mime_type = 'text/css'
        elif file_lower.endswith('.js'):
            mime_type = 'application/javascript'
        elif file_lower.endswith('.json'):
            mime_type = 'application/json'
        elif file_lower.endswith('.xml'):
            mime_type = 'application/xml'
        
        # Правильно кодируем имя файла для заголовка Content-Disposition (RFC 2231)
        from urllib.parse import quote
        # Используем ASCII имя для совместимости, если есть не-ASCII символы - используем UTF-8 кодировку
        try:
            file_name.encode('ascii')
            # Имя файла содержит только ASCII символы
            content_disposition = f'inline; filename="{file_name}"'
        except UnicodeEncodeError:
            # Имя файла содержит не-ASCII символы (кириллица и т.д.)
            # Используем RFC 2231 формат: filename*=UTF-8''encoded_name
            encoded_name = quote(file_name, safe='')
            content_disposition = f"inline; filename*=UTF-8''{encoded_name}"
        
        # Заголовки для правильного отображения
        headers = {
            'Content-Disposition': content_disposition,
            'Content-Type': mime_type,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'  # CORS для iframe
        }
        
        return Response(
            content=file_content,
            media_type=mime_type,
            headers=headers
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка просмотра файла: {str(e)}")

@app.get("/api/yandex-disk/view-link")
async def get_view_link_endpoint(file_path: str = Query(...), request: Optional[Any] = None):
    """
    Получить ссылку для просмотра файла через наш бэкэнд прокси
    Это позволяет обойти CSP ограничения Яндекс Диска
    
    Args:
        file_path: Путь к файлу
        request: Request объект для получения базового URL
    
    Returns:
        Ссылка для просмотра через наш бэкэнд
    """
    if not yandex_disk_api_available:
        raise HTTPException(status_code=503, detail="Модуль yandex_disk_api недоступен. Проверьте логи приложения.")
    try:
        # Используем наш бэкэнд эндпоинт для просмотра файла
        # Это позволяет открывать файлы в iframe без проблем с CSP
        from urllib.parse import quote
        from fastapi import Request
        
        encoded_path = quote(file_path, safe='')
        
        # Используем относительный URL для работы в любом окружении
        # Frontend сам добавит правильный базовый URL
        view_url = f"/api/yandex-disk/view?file_path={encoded_path}"
        
        return {
            'view_url': view_url,
            'file_path': file_path,
            'file_name': os.path.basename(file_path)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения ссылки: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
