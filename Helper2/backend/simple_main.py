"""
Упрощенный FastAPI Backend для демонстрации голосового помощника
Без Supabase интеграции - использует in-memory хранилище
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime, timezone
import logging
import os
from dotenv import load_dotenv
from pathlib import Path
import requests
import tempfile
import shutil

# Загружаем переменные окружения из .env файла
# Указываем явный путь к файлу .env в директории backend
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
from document_generator import DocumentGenerator
from smart_document_generator import SmartDocumentGenerator
from learning_document_generator import LearningDocumentGenerator
from local_learning_generator import LocalLearningGenerator
from supabase_learning_generator import SupabaseLearningGenerator
from yandex_disk_api import get_folder_contents, get_download_link, download_file, format_file_size, format_date, get_yandex_disk_folder_path, get_yandex_disk_public_key, get_public_view_link
from fastapi.responses import StreamingResponse, Response
from fastapi import UploadFile, File
from io import BytesIO

# Импорт PDF AI процессора
try:
    from pdf_ai_processor import get_pdf_processor, PDFAIProcessor
    PDF_AI_AVAILABLE = True
    USE_PADDLEOCR = True
except ImportError as e:
    PDF_AI_AVAILABLE = False
    USE_PADDLEOCR = False
    logger = logging.getLogger(__name__)
    logger.warning(f"PaddleOCR-VL не доступен: {e}")
    # Пробуем использовать упрощенную версию
    try:
        from pdf_processor_simple import get_simple_pdf_processor, SimplePDFProcessor
        PDF_AI_AVAILABLE = True
        USE_PADDLEOCR = False
        logger.info("✅ Используется упрощенный PDF процессор (без PaddleOCR)")

import tempfile
import shutil

# Импорт анализатора таблиц прогресса
try:
    from progress_table_analyzer import analyze_progress_table
    PROGRESS_ANALYZER_AVAILABLE = True
except ImportError as e:
    PROGRESS_ANALYZER_AVAILABLE = False
    # logger будет определен позже
    pass

# Импорт PDF AI процессора
try:
    from pdf_ai_processor import get_pdf_processor, PDFAIProcessor
    PDF_AI_AVAILABLE = True
except ImportError as e:
    logger.warning(f"PDF AI processor не доступен: {e}")
    PDF_AI_AVAILABLE = False

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Логируем статус анализатора таблиц прогресса
if not PROGRESS_ANALYZER_AVAILABLE:
    logger.warning("Анализатор таблиц прогресса не доступен. Установите зависимости: pip install requests pillow")

# In-memory хранилище для демонстрации
commands_storage = []
documents_storage = []

# Инициализация генераторов документов
doc_generator = DocumentGenerator()
smart_doc_generator = SmartDocumentGenerator()
learning_doc_generator = LearningDocumentGenerator()
local_learning_generator = LocalLearningGenerator()
supabase_learning_generator = SupabaseLearningGenerator()

# Модели данных
class CommandCreate(BaseModel):
    type: str = Field(..., description="Тип команды: create_act, print_act, create_defect, print_defect_report, smart_act, smart_defect_report, smart_work_report")
    payload: Dict[str, Any] = Field(..., description="Параметры команды")
    created_by: Optional[str] = Field(None, description="ID пользователя")

class CommandResponse(BaseModel):
    id: str
    type: str
    status: str
    created_at: datetime
    payload: Dict[str, Any]
    result_url: Optional[str] = None
    error_message: Optional[str] = None

class CommandUpdate(BaseModel):
    status: str
    result_url: Optional[str] = None
    error_message: Optional[str] = None

class CommandStatus(BaseModel):
    id: str
    type: str
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None
    attempt_count: int
    result_url: Optional[str] = None
    error_message: Optional[str] = None

# Создание FastAPI приложения
app = FastAPI(
    title="Voice Assistant API (Demo)",
    description="Демо API для голосового помощника строительного приложения",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Валидация типов команд
VALID_COMMAND_TYPES = {
    "create_act",
    "print_act", 
    "create_defect",
    "print_defect_report",
    "create_letter",
    "smart_act",
    "smart_defect_report",
    "smart_work_report",
    "learning_act",
    "learning_defect_report",
    "learning_work_report"
}

def validate_command_type(command_type: str) -> bool:
    """Проверяет валидность типа команды"""
    return command_type in VALID_COMMAND_TYPES

def validate_payload(command_type: str, payload: Dict[str, Any]) -> bool:
    """Валидирует payload в зависимости от типа команды"""
    if command_type == "create_act":
        required_fields = ["apartment_id", "act_type"]
        return all(field in payload for field in required_fields)
    elif command_type == "print_act":
        required_fields = ["apartment_id"]
        return all(field in payload for field in required_fields)
    elif command_type == "create_defect":
        required_fields = ["apartment_id", "defect_description"]
        return all(field in payload for field in required_fields)
    elif command_type == "print_defect_report":
        required_fields = ["apartment_id"]
        return all(field in payload for field in required_fields)
    return True

# API Endpoints

@app.get("/")
async def root():
    """Корневой endpoint"""
    return {
        "message": "Voice Assistant API (Demo) is running", 
        "version": "1.0.0",
        "storage": {
            "commands": len(commands_storage),
            "documents": len(documents_storage)
        }
    }

@app.get("/health")
async def health_check():
    """Проверка здоровья API"""
    return {
        "status": "healthy",
        "database": "in-memory",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "storage": {
            "commands": len(commands_storage),
            "documents": len(documents_storage)
        }
    }

@app.post("/api/commands", response_model=CommandResponse)
async def create_command(
    command: CommandCreate,
    background_tasks: BackgroundTasks
):
    """Создание новой команды"""
    try:
        # Валидация типа команды
        if not validate_command_type(command.type):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid command type. Must be one of: {', '.join(VALID_COMMAND_TYPES)}"
            )
        
        # Валидация payload
        if not validate_payload(command.type, command.payload):
            raise HTTPException(
                status_code=400,
                detail="Invalid payload for command type"
            )
        
        # Создание команды
        command_id = str(uuid.uuid4())
        command_data = {
            "id": command_id,
            "type": command.type,
            "payload": command.payload,
            "status": "pending",
            "created_by": command.created_by,
            "created_at": datetime.now(timezone.utc),
            "processed_at": None,
            "result_url": None,
            "error_message": None,
            "attempt_count": 0
        }
        
        commands_storage.append(command_data)
        
        # Логирование
        logger.info(f"Command created: {command_id} of type {command.type}")
        
        # Запуск фоновой задачи для имитации обработки
        background_tasks.add_task(process_command, command_id)
        
        return CommandResponse(
            id=command_data['id'],
            type=command_data['type'],
            status=command_data['status'],
            created_at=command_data['created_at'],
            payload=command_data['payload'],
            result_url=command_data.get('result_url'),
            error_message=command_data.get('error_message')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating command: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/commands/pending", response_model=List[CommandStatus])
async def get_pending_commands(limit: int = 10):
    """Получение pending команд (для агента)"""
    try:
        pending_commands = [
            cmd for cmd in commands_storage 
            if cmd['status'] == 'pending'
        ]
        
        # Сортируем по дате создания
        pending_commands.sort(key=lambda x: x['created_at'])
        
        # Ограничиваем количество
        pending_commands = pending_commands[:limit]
        
        commands = []
        for cmd in pending_commands:
            commands.append(CommandStatus(
                id=cmd['id'],
                type=cmd['type'],
                status=cmd['status'],
                created_at=cmd['created_at'],
                processed_at=cmd.get('processed_at'),
                attempt_count=cmd['attempt_count'],
                result_url=cmd.get('result_url'),
                error_message=cmd.get('error_message')
            ))
        
        return commands
        
    except Exception as e:
        logger.error(f"Error fetching pending commands: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/commands/{command_id}", response_model=CommandResponse)
async def get_command(command_id: str):
    """Получение команды по ID"""
    try:
        command = next((cmd for cmd in commands_storage if cmd['id'] == command_id), None)
        
        if not command:
            raise HTTPException(status_code=404, detail="Command not found")
        
        return CommandResponse(
            id=command['id'],
            type=command['type'],
            status=command['status'],
            created_at=command['created_at'],
            payload=command['payload'],
            result_url=command.get('result_url'),
            error_message=command.get('error_message')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching command {command_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.patch("/api/commands/{command_id}")
async def update_command(command_id: str, update: CommandUpdate):
    """Обновление статуса команды (для агента)"""
    try:
        # Находим команду
        command = next((cmd for cmd in commands_storage if cmd['id'] == command_id), None)
        
        if not command:
            raise HTTPException(status_code=404, detail="Command not found")
        
        # Обновляем команду
        command['status'] = update.status
        command['updated_at'] = datetime.now(timezone.utc)
        
        if update.status in ["done", "failed"]:
            command['processed_at'] = datetime.now(timezone.utc)
        
        if update.result_url:
            command['result_url'] = update.result_url
            
        if update.error_message:
            command['error_message'] = update.error_message
        
        logger.info(f"Command {command_id} updated to status {update.status}")
        
        return {"message": "Command updated successfully", "command_id": command_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating command {command_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/commands/{command_id}/status")
async def get_command_status(command_id: str):
    """Получение статуса команды (для мобильного приложения)"""
    try:
        command = next((cmd for cmd in commands_storage if cmd['id'] == command_id), None)
        
        if not command:
            raise HTTPException(status_code=404, detail="Command not found")
        
        return {
            "id": command_id,
            "status": command['status'],
            "result_url": command.get('result_url'),
            "error_message": command.get('error_message'),
            "processed_at": command.get('processed_at')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching command status {command_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/commands")
async def get_all_commands(limit: int = 50):
    """Получение всех команд (для отладки)"""
    try:
        # Сортируем по дате создания (новые сначала)
        sorted_commands = sorted(commands_storage, key=lambda x: x['created_at'], reverse=True)
        
        # Ограничиваем количество
        sorted_commands = sorted_commands[:limit]
        
        return {
            "commands": sorted_commands,
            "total": len(commands_storage),
            "returned": len(sorted_commands)
        }
        
    except Exception as e:
        logger.error(f"Error fetching all commands: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/documents/{document_id}/download")
async def download_document(document_id: str):
    """Скачивание сгенерированного документа"""
    try:
        # Находим документ
        document = next((doc for doc in documents_storage if doc['id'] == document_id), None)
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        file_path = document['file_path']
        file_name = document['file_name']
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Document file not found")
        
        logger.info(f"Serving document: {file_name}")
        
        return FileResponse(
            path=file_path,
            filename=file_name,
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/search")
def web_search(q: Optional[str] = None):
    """Поиск в интернете (DuckDuckGo) для контекста нейросети."""
    if not q or not q.strip():
        return {"query": "", "snippets": []}
    try:
        r = requests.get(
            "https://api.duckduckgo.com/",
            params={"q": q.strip(), "format": "json", "no_redirect": "1"},
            timeout=8,
            headers={"User-Agent": "ConstructionAssistant/1.0"}
        )
        r.raise_for_status()
        data = r.json()
        snippets = []
        if data.get("AbstractText"):
            snippets.append(data["AbstractText"])
        for topic in data.get("RelatedTopics", [])[:8]:
            if isinstance(topic, dict) and topic.get("Text"):
                snippets.append(topic["Text"])
            elif isinstance(topic, dict) and topic.get("Topics"):
                for t in topic["Topics"][:3]:
                    if isinstance(t, dict) and t.get("Text"):
                        snippets.append(t["Text"])
        return {"query": q.strip(), "snippets": list(filter(None, snippets))}
    except Exception as e:
        logger.warning(f"Web search error: {e}")
        return {"query": q.strip(), "snippets": []}


# Яндекс Диск API endpoints

@app.get("/api/yandex-disk/files")
async def get_yandex_disk_files(folder_path: Optional[str] = None):
    """Получить список файлов из папки на Яндекс Диске (поддерживает публичные папки)"""
    try:
        # Нормализуем путь: убираем префикс "disk:" если есть
        if folder_path and folder_path.startswith('disk:'):
            folder_path = folder_path[5:]  # Убираем "disk:"
        
        files = get_folder_contents(folder_path)
        
        # Получаем публичный ключ, если используется публичная папка
        public_key = get_yandex_disk_public_key()
        
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
                'public_key': file.get('public_key') or public_key  # Передаем публичный ключ для скачивания
            }
            formatted_files.append(formatted_file)
        
        return {
            'files': formatted_files,
            'total': len(formatted_files),
            'folder_path': folder_path or get_yandex_disk_folder_path(),
            'is_public': public_key is not None,
            'public_key': public_key
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting Yandex Disk files: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения файлов: {str(e)}")

@app.get("/api/yandex-disk/download")
async def download_yandex_disk_file(file_path: str):
    """Скачать файл с Яндекс Диска (поддерживает публичные папки)"""
    try:
        # Нормализуем путь: убираем префикс "disk:" если есть
        if file_path.startswith('disk:'):
            file_path = file_path[5:]  # Убираем "disk:"
        
        # Получаем публичный ключ, если используется публичная папка
        public_key = get_yandex_disk_public_key()
        # Получаем содержимое файла
        file_content = download_file(file_path, public_key=public_key)
        
        # Извлекаем имя файла из пути
        file_name = os.path.basename(file_path)
        
        # Определяем MIME тип по расширению
        mime_type = 'application/octet-stream'
        if file_name.endswith('.pdf'):
            mime_type = 'application/pdf'
        elif file_name.endswith('.docx'):
            mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        elif file_name.endswith('.doc'):
            mime_type = 'application/msword'
        elif file_name.endswith('.xlsx'):
            mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        elif file_name.endswith('.jpg') or file_name.endswith('.jpeg'):
            mime_type = 'image/jpeg'
        elif file_name.endswith('.png'):
            mime_type = 'image/png'
        
        # Правильно кодируем имя файла для заголовка Content-Disposition (RFC 2231)
        from urllib.parse import quote
        try:
            file_name.encode('ascii')
            # Имя файла содержит только ASCII символы
            content_disposition = f'attachment; filename="{file_name}"'
        except UnicodeEncodeError:
            # Имя файла содержит не-ASCII символы (кириллица и т.д.)
            # Используем RFC 2231 формат: filename*=UTF-8''encoded_name
            encoded_name = quote(file_name, safe='')
            content_disposition = f"attachment; filename*=UTF-8''{encoded_name}"
        
        # Создаем поток для скачивания
        file_stream = BytesIO(file_content)
        
        return StreamingResponse(
            file_stream,
            media_type=mime_type,
            headers={
                'Content-Disposition': content_disposition
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error downloading Yandex Disk file {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка скачивания файла: {str(e)}")

@app.get("/api/yandex-disk/download-link")
async def get_yandex_disk_download_link(file_path: str):
    """Получить прямую ссылку для скачивания файла с Яндекс Диска (поддерживает публичные папки)"""
    try:
        # Нормализуем путь: убираем префикс "disk:" если есть
        if file_path.startswith('disk:'):
            file_path = file_path[5:]  # Убираем "disk:"
        
        # Получаем публичный ключ, если используется публичная папка
        public_key = get_yandex_disk_public_key()
        download_url = get_download_link(file_path, public_key=public_key)
        return {
            'download_url': download_url,
            'file_path': file_path,
            'file_name': os.path.basename(file_path)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting Yandex Disk download link for {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения ссылки: {str(e)}")

@app.get("/api/yandex-disk/view")
async def view_yandex_disk_file(file_path: str):
    """Просмотр файла с Яндекс Диска в браузере (поддерживает публичные папки)"""
    try:
        # Нормализуем путь: убираем префикс "disk:" если есть
        if file_path.startswith('disk:'):
            file_path = file_path[5:]  # Убираем "disk:"
        
        # Получаем публичный ключ, если используется публичная папка
        public_key = get_yandex_disk_public_key()
        
        # Логируем для отладки
        logger.info(f"Viewing file: {file_path}, public_key: {public_key}")
        
        # Получаем содержимое файла
        file_content = download_file(file_path, public_key=public_key)
        
        # Извлекаем имя файла из пути
        file_name = os.path.basename(file_path)
        
        # Определяем MIME тип по расширению для правильного отображения в браузере
        mime_type = 'application/octet-stream'
        file_lower = file_name.lower()
        
        # PDF
        if file_lower.endswith('.pdf'):
            mime_type = 'application/pdf'
        # Office документы
        elif file_lower.endswith('.docx'):
            mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        elif file_lower.endswith('.doc'):
            mime_type = 'application/msword'
        elif file_lower.endswith('.xlsx'):
            mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        elif file_lower.endswith('.xls'):
            mime_type = 'application/vnd.ms-excel'
        # Изображения
        elif file_lower.endswith('.jpg') or file_lower.endswith('.jpeg'):
            mime_type = 'image/jpeg'
        elif file_lower.endswith('.png'):
            mime_type = 'image/png'
        elif file_lower.endswith('.gif'):
            mime_type = 'image/gif'
        elif file_lower.endswith('.webp'):
            mime_type = 'image/webp'
        elif file_lower.endswith('.bmp'):
            mime_type = 'image/bmp'
        elif file_lower.endswith('.svg'):
            mime_type = 'image/svg+xml'
        elif file_lower.endswith('.heic') or file_lower.endswith('.heif'):
            # HEIC формат - не поддерживается браузерами, но указываем правильный MIME
            mime_type = 'image/heic'
        # Видео
        elif file_lower.endswith('.mp4'):
            mime_type = 'video/mp4'
        elif file_lower.endswith('.webm'):
            mime_type = 'video/webm'
        elif file_lower.endswith('.ogg') or file_lower.endswith('.ogv'):
            mime_type = 'video/ogg'
        elif file_lower.endswith('.avi'):
            mime_type = 'video/x-msvideo'
        elif file_lower.endswith('.mov'):
            mime_type = 'video/quicktime'
        elif file_lower.endswith('.wmv'):
            mime_type = 'video/x-ms-wmv'
        elif file_lower.endswith('.flv'):
            mime_type = 'video/x-flv'
        elif file_lower.endswith('.mkv'):
            mime_type = 'video/x-matroska'
        elif file_lower.endswith('.m4v'):
            mime_type = 'video/x-m4v'
        # Текст
        elif file_lower.endswith('.txt'):
            mime_type = 'text/plain; charset=utf-8'
        elif file_lower.endswith('.html') or file_lower.endswith('.htm'):
            mime_type = 'text/html'
        
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
        
        # Для изображений и видео добавляем CORS заголовки для правильного отображения
        headers = {
            'Content-Disposition': content_disposition,
            'X-Content-Type-Options': 'nosniff'
        }
        
        # Добавляем CORS заголовки для изображений и видео
        if mime_type.startswith('image/') or mime_type.startswith('video/'):
            headers['Access-Control-Allow-Origin'] = '*'
            headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            headers['Access-Control-Allow-Headers'] = '*'
            headers['Cache-Control'] = 'public, max-age=3600'
        
        # Используем Response вместо StreamingResponse для бинарных данных в памяти
        return Response(
            content=file_content,
            media_type=mime_type,
            headers=headers
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error viewing Yandex Disk file {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка просмотра файла: {str(e)}")

@app.get("/api/yandex-disk/view-link")
async def get_yandex_disk_view_link(file_path: str):
    """Получить ссылку для просмотра файла с Яндекс Диска (поддерживает публичные папки)"""
    try:
        # Используем полный URL для backend API
        from urllib.parse import quote
        encoded_path = quote(file_path, safe='')
        # Используем localhost:8000 для backend API
        view_url = f"http://localhost:8000/api/yandex-disk/view?file_path={encoded_path}"
        
        return {
            'view_url': view_url,
            'file_path': file_path,
            'file_name': os.path.basename(file_path)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting Yandex Disk view link for {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения ссылки для просмотра: {str(e)}")

@app.get("/api/yandex-disk/refresh")
async def refresh_yandex_disk_files(folder_path: Optional[str] = None):
    """Обновить список файлов из папки на Яндекс Диске (алиас для get_yandex_disk_files)"""
    return await get_yandex_disk_files(folder_path)

# Фоновые задачи
async def process_command(command_id: str):
    """Реальная обработка команды с генерацией документов"""
    import asyncio
    
    try:
        # Находим команду
        command = next((cmd for cmd in commands_storage if cmd['id'] == command_id), None)
        
        if not command:
            logger.error(f"Command {command_id} not found for processing")
            return
        
        logger.info(f"Processing command {command_id} of type {command['type']}")
        
        # Обновляем статус на "processing"
        command['status'] = 'processing'
        command['attempt_count'] += 1
        
        # Имитируем небольшую задержку
        await asyncio.sleep(1)
        
        # Генерируем документ в зависимости от типа команды
        document_path = None
        
        # Проверяем, нужно ли использовать умный генератор (с реальными данными)
        use_smart_generator = command['payload'].get('meta', {}).get('use_real_data', True)
        
        if command['type'] == 'create_act':
            # Используем профессиональный шаблон для создания актов
            document_path = supabase_learning_generator.generate_professional_document('handover_act', command['payload'])
            logger.info(f"Generated professional handover act: {document_path}")
            
        elif command['type'] == 'create_defect':
            # Используем профессиональный шаблон для создания отчетов о дефектах
            document_path = supabase_learning_generator.generate_professional_document('defect_report', command['payload'])
            logger.info(f"Generated professional defect report: {document_path}")
            
        elif command['type'] == 'print_defect_report':
            # Используем профессиональный шаблон для создания отчетов о работах
            document_path = supabase_learning_generator.generate_professional_document('work_report', command['payload'])
            logger.info(f"Generated professional work report: {document_path}")
            
        elif command['type'] == 'create_letter':
            # Используем профессиональный шаблон для создания писем
            document_path = supabase_learning_generator.generate_professional_document('official_letter', command['payload'])
            logger.info(f"Generated professional letter: {document_path}")
        
        elif command['type'] == 'smart_act':
            document_path = smart_doc_generator.generate_smart_handover_act(command['payload'])
            logger.info(f"Generated smart handover act: {document_path}")
            
        elif command['type'] == 'smart_defect_report':
            document_path = smart_doc_generator.generate_smart_defect_report(command['payload'])
            logger.info(f"Generated smart defect report: {document_path}")
            
        elif command['type'] == 'smart_work_report':
            document_path = smart_doc_generator.generate_smart_work_report(command['payload'])
            logger.info(f"Generated smart work report: {document_path}")
        
        elif command['type'] == 'learning_act':
            # Используем Supabase генератор (использует примеры из Storage)
            document_path = supabase_learning_generator.generate_based_on_supabase_examples('handover_act', command['payload'])
            logger.info(f"Generated Supabase learning-based handover act: {document_path}")
            
        elif command['type'] == 'learning_defect_report':
            # Используем Supabase генератор (использует примеры из Storage)
            document_path = supabase_learning_generator.generate_based_on_supabase_examples('defect_report', command['payload'])
            logger.info(f"Generated Supabase learning-based defect report: {document_path}")
            
        elif command['type'] == 'learning_work_report':
            # Используем Supabase генератор (использует примеры из Storage)
            document_path = supabase_learning_generator.generate_based_on_supabase_examples('work_report', command['payload'])
            logger.info(f"Generated Supabase learning-based work report: {document_path}")
            
        else:
            # Для других типов команд генерируем общий отчет
            if use_smart_generator:
                document_path = smart_doc_generator.generate_smart_work_report(command['payload'])
                logger.info(f"Generated smart general report: {document_path}")
            else:
                document_path = doc_generator.generate_work_report(command['payload'])
                logger.info(f"Generated general report: {document_path}")
        
        if document_path and os.path.exists(document_path):
            # Создаем запись о документе
            document_record = {
                'id': str(uuid.uuid4()),
                'command_id': command_id,
                'file_path': document_path,
                'file_name': os.path.basename(document_path),
                'created_at': datetime.now(timezone.utc)
            }
            documents_storage.append(document_record)
            
            # Обновляем команду
            command['status'] = 'done'
            command['processed_at'] = datetime.now(timezone.utc)
            command['result_url'] = f"/api/documents/{document_record['id']}/download"
            
            logger.info(f"Command {command_id} processed successfully, document: {document_path}")
        else:
            raise Exception("Failed to generate document")
        
    except Exception as e:
        logger.error(f"Error processing command {command_id}: {e}")
        
        # Обновляем статус на "failed"
        command = next((cmd for cmd in commands_storage if cmd['id'] == command_id), None)
        if command:
            command['status'] = 'failed'
            command['error_message'] = str(e)
            command['processed_at'] = datetime.now(timezone.utc)


# ==================== PDF AI Processing Endpoints ====================

class PDFProcessRequest(BaseModel):
    """Запрос на обработку PDF"""
    pdf_url: Optional[str] = Field(None, description="URL PDF файла")
    extract_text: bool = Field(True, description="Извлекать текст")
    extract_tables: bool = Field(True, description="Извлекать таблицы")
    extract_formulas: bool = Field(True, description="Извлекать формулы")
    extract_charts: bool = Field(True, description="Извлекать графики")


@app.post("/api/pdf/process")
async def process_pdf_file(
    file: UploadFile = File(...),
    extract_text: bool = True,
    extract_tables: bool = True,
    extract_formulas: bool = True,
    extract_charts: bool = True
):
    """
    Обработка загруженного PDF файла с помощью PaddleOCR-VL
    
    Args:
        file: Загруженный PDF файл
        extract_text: Извлекать текст
        extract_tables: Извлекать таблицы
        extract_formulas: Извлекать формулы
        extract_charts: Извлекать графики
    
    Returns:
        Результаты обработки PDF
    """
    if not PDF_AI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="PDF AI processor не доступен. Установите зависимости: pip install paddleocr[doc-parser]"
        )
    
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Файл должен быть в формате PDF")
    
    try:
        # Сохраняем загруженный файл во временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_path = tmp_file.name
        
        try:
            # Обрабатываем PDF (используем PaddleOCR если доступен, иначе упрощенную версию)
            if USE_PADDLEOCR:
                processor = get_pdf_processor()
            else:
                from pdf_processor_simple import get_simple_pdf_processor
                processor = get_simple_pdf_processor()
            results = processor.process_pdf_file(tmp_path)
            
            # Фильтруем результаты в зависимости от параметров
            filtered_results = {
                'file_name': results['file_name'],
                'file_size': results['file_size'],
                'pages': results['pages'],
                'metadata': results['metadata']
            }
            
            if extract_text:
                filtered_results['text'] = results.get('text', '')
            
            if extract_tables:
                filtered_results['tables'] = results.get('tables', [])
            
            if extract_formulas:
                filtered_results['formulas'] = results.get('formulas', [])
            
            if extract_charts:
                filtered_results['charts'] = results.get('charts', [])
            
            filtered_results['structure'] = results.get('structure', {})
            
            logger.info(f"✅ PDF обработан: {file.filename}")
            return {
                'success': True,
                'data': filtered_results
            }
        
        finally:
            # Удаляем временный файл
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    except Exception as e:
        logger.error(f"❌ Ошибка обработки PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обработки PDF: {str(e)}")


@app.post("/api/pdf/process-url")
async def process_pdf_url(request: PDFProcessRequest):
    """
    Обработка PDF файла по URL с помощью PaddleOCR-VL
    
    Args:
        request: Запрос с URL и параметрами извлечения
    
    Returns:
        Результаты обработки PDF
    """
    if not PDF_AI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="PDF AI processor не доступен. Установите зависимости: pip install paddleocr[doc-parser]"
        )
    
    if not request.pdf_url:
        raise HTTPException(status_code=400, detail="Не указан URL PDF файла")
    
    try:
        # Используем PaddleOCR если доступен, иначе упрощенную версию
        if USE_PADDLEOCR:
            processor = get_pdf_processor()
        else:
            from pdf_processor_simple import get_simple_pdf_processor
            processor = get_simple_pdf_processor()
        results = processor.process_pdf_url(request.pdf_url)
        
        # Фильтруем результаты
        filtered_results = {
            'file_name': results['file_name'],
            'file_size': results['file_size'],
            'pages': results['pages'],
            'metadata': results['metadata']
        }
        
        if request.extract_text:
            filtered_results['text'] = results.get('text', '')
        
        if request.extract_tables:
            filtered_results['tables'] = results.get('tables', [])
        
        if request.extract_formulas:
            filtered_results['formulas'] = results.get('formulas', [])
        
        if request.extract_charts:
            filtered_results['charts'] = results.get('charts', [])
        
        filtered_results['structure'] = results.get('structure', {})
        
        logger.info(f"✅ PDF обработан по URL: {request.pdf_url}")
        return {
            'success': True,
            'data': filtered_results
        }
    
    except Exception as e:
        logger.error(f"❌ Ошибка обработки PDF по URL: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обработки PDF: {str(e)}")


@app.get("/api/pdf/extract-text")
async def extract_pdf_text(pdf_url: str):
    """
    Быстрое извлечение только текста из PDF
    
    Args:
        pdf_url: URL PDF файла
    
    Returns:
        Извлеченный текст
    """
    if not PDF_AI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="PDF AI processor не доступен"
        )
    
    try:
        if USE_PADDLEOCR:
            processor = get_pdf_processor()
        else:
            from pdf_processor_simple import get_simple_pdf_processor
            processor = get_simple_pdf_processor()
        text = processor.extract_text_only(pdf_url)
        
        return {
            'success': True,
            'text': text,
            'length': len(text)
        }
    
    except Exception as e:
        logger.error(f"❌ Ошибка извлечения текста: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка извлечения текста: {str(e)}")


@app.get("/api/pdf/extract-tables")
async def extract_pdf_tables(pdf_url: str):
    """
    Извлечение только таблиц из PDF
    
    Args:
        pdf_url: URL PDF файла
    
    Returns:
        Список извлеченных таблиц
    """
    if not PDF_AI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="PDF AI processor не доступен"
        )
    
    try:
        if USE_PADDLEOCR:
            processor = get_pdf_processor()
        else:
            from pdf_processor_simple import get_simple_pdf_processor
            processor = get_simple_pdf_processor()
        tables = processor.extract_tables_only(pdf_url)
        
        return {
            'success': True,
            'tables': tables,
            'count': len(tables)
        }
    
    except Exception as e:
        logger.error(f"❌ Ошибка извлечения таблиц: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка извлечения таблиц: {str(e)}")


@app.get("/api/pdf/health")
async def pdf_ai_health():
    """
    Проверка доступности PDF AI процессора
    
    Returns:
        Статус доступности
    """
    return {
        'available': PDF_AI_AVAILABLE,
        'model': 'PaddleOCR-VL-0.9B' if USE_PADDLEOCR else 'SimplePDFProcessor',
        'features': {
            'text_extraction': True,
            'tables': USE_PADDLEOCR,
            'formulas': USE_PADDLEOCR,
            'charts': USE_PADDLEOCR,
            'ocr': USE_PADDLEOCR
        },
        'message': 'PDF AI processor готов к работе' if PDF_AI_AVAILABLE else 'PDF AI processor не установлен'
    }


# ============================================
# API для анализа таблиц прогресса работ
# ============================================

class ProgressTableAnalysisRequest(BaseModel):
    image: str = Field(..., description="Base64 строка изображения таблицы прогресса")


@app.post("/api/progress/analyze-table")
async def analyze_progress_table_endpoint(request: ProgressTableAnalysisRequest):
    """
    Анализирует изображение таблицы прогресса и извлекает данные о работах и процентах выполнения
    
    Args:
        request: Запрос с base64 изображением таблицы
    
    Returns:
        Результаты анализа с извлеченными данными
    """
    if not PROGRESS_ANALYZER_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Анализатор таблиц прогресса не доступен. Проверьте установку зависимостей."
        )
    
    try:
        logger.info("Начало анализа таблицы прогресса...")
        results = analyze_progress_table(request.image)
        
        logger.info(f"✅ Анализ завершен. Извлечено {len(results)} записей")
        
        return {
            "success": True,
            "results": results,
            "count": len(results),
            "message": f"Успешно извлечено {len(results)} записей из таблицы"
        }
    
    except Exception as e:
        logger.error(f"Ошибка анализа таблицы прогресса: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка анализа таблицы: {str(e)}")


@app.post("/api/progress/analyze-table-file")
async def analyze_progress_table_file(file: UploadFile = File(...)):
    """
    Анализирует загруженный файл изображения таблицы прогресса
    
    Args:
        file: Загруженный файл изображения
    
    Returns:
        Результаты анализа с извлеченными данными
    """
    if not PROGRESS_ANALYZER_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Анализатор таблиц прогресса не доступен. Проверьте установку зависимостей."
        )
    
    # Проверяем тип файла
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Файл должен быть изображением")
    
    try:
        # Читаем файл и конвертируем в base64
        image_bytes = await file.read()
        import base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        logger.info(f"Начало анализа таблицы прогресса из файла {file.filename}...")
        results = analyze_progress_table(image_base64)
        
        logger.info(f"✅ Анализ завершен. Извлечено {len(results)} записей")
        
        return {
            "success": True,
            "results": results,
            "count": len(results),
            "message": f"Успешно извлечено {len(results)} записей из таблицы"
        }
    
    except Exception as e:
        logger.error(f"Ошибка анализа таблицы прогресса: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка анализа таблицы: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

