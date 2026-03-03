"""
API для работы с Яндекс Диском
Только чтение и скачивание файлов из папки с общим доступом
"""

import os
import requests
from typing import List, Dict, Optional, Any
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Загружаем переменные окружения из .env файла
# Используем абсолютный путь к файлу .env в директории backend
script_file = Path(__file__).resolve()
script_dir = script_file.parent

# Ищем .env файл в директории backend
# Убираем рекурсивные пути, находим первый 'backend' в пути
parts = list(script_dir.parts)
backend_indices = [i for i, part in enumerate(parts) if part == 'backend']

if backend_indices:
    # Берем первый индекс 'backend'
    backend_index = backend_indices[0]
    backend_dir = Path(*parts[:backend_index + 1])
    env_path = backend_dir / ".env"
else:
    # Если не нашли 'backend', используем директорию скрипта
    env_path = script_dir / ".env"

# Пробуем несколько вариантов загрузки
env_paths_to_try = [
    env_path,  # Основной путь
    script_dir / ".env",  # Рядом со скриптом
    Path.cwd() / ".env",  # В текущей рабочей директории
]

loaded = False
for path in env_paths_to_try:
    if path.exists():
        load_dotenv(dotenv_path=path, override=True)
        loaded = True
        break

# Если ни один файл не найден, пробуем загрузить из текущей директории
if not loaded:
    load_dotenv(override=True)

# Дополнительная проверка: загружаем из всех найденных файлов .env
# Это гарантирует, что переменные будут загружены
for path in env_paths_to_try:
    if path.exists():
        load_dotenv(dotenv_path=path, override=True)
        break

# Базовый URL API Яндекс Диска
YANDEX_DISK_API_BASE = "https://cloud-api.yandex.net/v1/disk"

def get_yandex_disk_token() -> Optional[str]:
    """Получить OAuth токен из переменных окружения"""
    return os.getenv('YANDEX_DISK_TOKEN')

def get_yandex_disk_folder_path() -> str:
    """Получить путь к папке на Яндекс Диске"""
    # По умолчанию показываем корневую папку (все доступные папки)
    folder_path = os.getenv('YANDEX_DISK_FOLDER_PATH', '/')
    # Если путь пустой, используем корневую папку
    if not folder_path or folder_path.strip() == '':
        folder_path = '/'
    # Импортируем функцию для использования в simple_main.py
    return folder_path

def get_yandex_disk_public_key() -> Optional[str]:
    """Получить публичный ключ папки из переменных окружения"""
    key = os.getenv('YANDEX_DISK_PUBLIC_KEY')
    # Проверяем, что ключ не пустая строка
    if key and key.strip():
        return key.strip()
    return None

def is_public_folder() -> bool:
    """Проверить, используется ли публичная папка"""
    return get_yandex_disk_public_key() is not None

def get_headers() -> Dict[str, str]:
    """Получить заголовки для запросов к API"""
    # Если используется публичная папка, токен не нужен
    if get_yandex_disk_public_key():
        return {
            'Accept': 'application/json'
        }
    
    # Для обычных папок требуется OAuth токен
    token = get_yandex_disk_token()
    if not token:
        raise ValueError("YANDEX_DISK_TOKEN не установлен в переменных окружения. Для публичной папки используйте YANDEX_DISK_PUBLIC_KEY")
    
    return {
        'Authorization': f'OAuth {token}',
        'Accept': 'application/json'
    }

def get_folder_contents(folder_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Получить список файлов и папок из указанной папки на Яндекс Диске
    Поддерживает как обычные папки (с OAuth токеном), так и публичные папки (без токена)
    
    Приоритет: OAuth токен для доступа к корню, затем публичный ключ для конкретной папки
    
    Args:
        folder_path: Путь к папке на Яндекс Диске (если None или '/', используется корень)
    
    Returns:
        Список словарей с информацией о файлах и папках
    """
    try:
        # Нормализуем путь
        if folder_path is None:
            folder_path = '/'
        
        # Убираем префикс "disk:" если есть
        if folder_path.startswith('disk:'):
            folder_path = folder_path[5:]
        
        # Нормализуем путь (убираем лишние слэши)
        folder_path = folder_path.strip('/')
        if not folder_path:
            folder_path = '/'
        else:
            folder_path = f'/{folder_path}'
        
        # Проверяем наличие OAuth токена
        token = get_yandex_disk_token()
        public_key = get_yandex_disk_public_key()
        
        # Отладочный вывод
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Yandex Disk: token={'есть' if token else 'нет'}, public_key={public_key}, folder_path={folder_path}")
        
        # ПРИОРИТЕТ 1: Если есть OAuth токен И запрашивается корень - используем OAuth для доступа к корню
        if token and token.strip() and folder_path == '/':
            logger.info("Используется OAuth токен для доступа к корню Яндекс Диска")
            url = f"{YANDEX_DISK_API_BASE}/resources"
            params = {
                'path': '/',
                'limit': 1000,
                'sort': '-modified'
            }
            headers = get_headers()
            response = requests.get(url, headers=headers, params=params, timeout=60)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('_embedded', {}).get('items', [])
                
                formatted_items = []
                for item in items:
                    formatted_item = {
                        'name': item.get('name', ''),
                        'path': item.get('path', ''),
                        'type': item.get('type', 'file'),
                        'size': item.get('size', 0),
                        'modified': item.get('modified', ''),
                        'created': item.get('created', ''),
                        'mime_type': item.get('mime_type', ''),
                        'preview': item.get('preview', ''),
                        'file': item.get('file', ''),
                        'public_url': item.get('public_url', '')
                    }
                    formatted_items.append(formatted_item)
                
                return formatted_items
            elif response.status_code == 401:
                raise ValueError("Неверный OAuth токен или токен истек")
            else:
                error_data = response.json() if response.content else {}
                error_message = error_data.get('message', f'Ошибка API: {response.status_code}')
                raise Exception(f"Ошибка получения списка файлов: {error_message}")
        
        # ПРИОРИТЕТ 2: Если есть OAuth токен И запрашивается подпапка - используем OAuth
        if token and token.strip():
            logger.info(f"Используется OAuth токен для доступа к папке: {folder_path}")
            url = f"{YANDEX_DISK_API_BASE}/resources"
            params = {
                'path': folder_path,
                'limit': 1000,
                'sort': '-modified'
            }
            headers = get_headers()
            response = requests.get(url, headers=headers, params=params, timeout=60)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('_embedded', {}).get('items', [])
                
                formatted_items = []
                for item in items:
                    formatted_item = {
                        'name': item.get('name', ''),
                        'path': item.get('path', ''),
                        'type': item.get('type', 'file'),
                        'size': item.get('size', 0),
                        'modified': item.get('modified', ''),
                        'created': item.get('created', ''),
                        'mime_type': item.get('mime_type', ''),
                        'preview': item.get('preview', ''),
                        'file': item.get('file', ''),
                        'public_url': item.get('public_url', '')
                    }
                    formatted_items.append(formatted_item)
                
                return formatted_items
            elif response.status_code == 401:
                raise ValueError("Неверный OAuth токен или токен истек")
            elif response.status_code == 404:
                raise ValueError(f"Папка не найдена: {folder_path}")
            else:
                error_data = response.json() if response.content else {}
                error_message = error_data.get('message', f'Ошибка API: {response.status_code}')
                raise Exception(f"Ошибка получения списка файлов: {error_message}")
        
        # ПРИОРИТЕТ 3: Если нет OAuth токена, но есть публичный ключ - используем публичную папку
        if public_key:
            logger.info(f"Используется публичная папка с ключом: {public_key}")
            return get_public_folder_contents(public_key, folder_path if folder_path != '/' else None)
        
        # Если ничего не настроено
        raise ValueError(
            "Не настроен ни YANDEX_DISK_TOKEN, ни YANDEX_DISK_PUBLIC_KEY. "
            "Для доступа к корню Яндекс Диска установите YANDEX_DISK_TOKEN в файле .env"
        )
        
        # Нормализуем путь: убираем префикс "disk:" если есть
        if folder_path and folder_path.startswith('disk:'):
            folder_path = folder_path[5:]  # Убираем "disk:"
        
        # Нормализуем путь (убираем лишние слэши)
        folder_path = folder_path.strip('/')
        if not folder_path:
            folder_path = '/'
        else:
            folder_path = f'/{folder_path}'
        
        url = f"{YANDEX_DISK_API_BASE}/resources"
        params = {
            'path': folder_path,
            'limit': 1000,  # Максимальное количество файлов
            'sort': '-modified'  # Сортировка по дате изменения (новые сначала)
        }
        
        headers = get_headers()
        response = requests.get(url, headers=headers, params=params, timeout=60)  # Увеличено до 60 секунд для больших папок
        
        if response.status_code == 200:
            data = response.json()
            items = data.get('_embedded', {}).get('items', [])
            
            # Форматируем данные для удобства использования
            formatted_items = []
            for item in items:
                formatted_item = {
                    'name': item.get('name', ''),
                    'path': item.get('path', ''),
                    'type': item.get('type', 'file'),  # 'file' или 'dir'
                    'size': item.get('size', 0),
                    'modified': item.get('modified', ''),
                    'created': item.get('created', ''),
                    'mime_type': item.get('mime_type', ''),
                    'preview': item.get('preview', ''),
                    'file': item.get('file', ''),
                    'public_url': item.get('public_url', '')
                }
                formatted_items.append(formatted_item)
            
            return formatted_items
        elif response.status_code == 401:
            raise ValueError("Неверный OAuth токен или токен истек")
        elif response.status_code == 403:
            raise ValueError("Нет доступа к указанной папке")
        elif response.status_code == 404:
            raise ValueError(f"Папка не найдена: {folder_path}")
        else:
            error_data = response.json() if response.content else {}
            error_message = error_data.get('message', f'Ошибка API: {response.status_code}')
            raise Exception(f"Ошибка получения списка файлов: {error_message}")
    
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ошибка подключения к API Яндекс Диска: {str(e)}")
    except Exception as e:
        raise Exception(f"Ошибка при получении списка файлов: {str(e)}")

def get_download_link(file_path: str, public_key: Optional[str] = None) -> str:
    """
    Получить прямую ссылку для скачивания файла
    Поддерживает как обычные папки (с OAuth токеном), так и публичные папки (без токена)
    
    Args:
        file_path: Путь к файлу на Яндекс Диске
        public_key: Публичный ключ папки (если используется публичная папка)
    
    Returns:
        URL для скачивания файла
    """
    try:
        # Если указан публичный ключ, используем публичный API
        if public_key:
            return get_public_download_link(public_key, file_path)
        
        # Проверяем, используется ли публичная папка по умолчанию
        default_public_key = get_yandex_disk_public_key()
        if default_public_key:
            return get_public_download_link(default_public_key, file_path)
        
        # Работа с обычной папкой (требуется OAuth токен)
        # Нормализуем путь: убираем префикс "disk:" если есть
        if file_path.startswith('disk:'):
            file_path = file_path[5:]  # Убираем "disk:"
        
        # Нормализуем путь
        file_path = file_path.strip('/')
        if not file_path.startswith('/'):
            file_path = f'/{file_path}'
        
        url = f"{YANDEX_DISK_API_BASE}/resources/download"
        params = {
            'path': file_path
        }
        
        headers = get_headers()
        response = requests.get(url, headers=headers, params=params, timeout=60)  # Увеличено до 60 секунд для больших папок
        
        if response.status_code == 200:
            data = response.json()
            download_url = data.get('href', '')
            if not download_url:
                raise Exception("API не вернул ссылку для скачивания")
            return download_url
        elif response.status_code == 401:
            raise ValueError("Неверный OAuth токен или токен истек")
        elif response.status_code == 403:
            raise ValueError("Нет доступа к файлу")
        elif response.status_code == 404:
            raise ValueError(f"Файл не найден: {file_path}")
        else:
            error_data = response.json() if response.content else {}
            error_message = error_data.get('message', f'Ошибка API: {response.status_code}')
            raise Exception(f"Ошибка получения ссылки для скачивания: {error_message}")
    
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ошибка подключения к API Яндекс Диска: {str(e)}")
    except Exception as e:
        raise Exception(f"Ошибка при получении ссылки для скачивания: {str(e)}")

def download_file(file_path: str, save_path: Optional[str] = None, public_key: Optional[str] = None) -> bytes:
    """
    Скачать файл с Яндекс Диска
    Поддерживает как обычные папки (с OAuth токеном), так и публичные папки (без токена)
    
    Args:
        file_path: Путь к файлу на Яндекс Диске
        save_path: Путь для сохранения файла (если None, возвращает bytes)
        public_key: Публичный ключ папки (если используется публичная папка)
    
    Returns:
        Содержимое файла в виде bytes
    """
    try:
        # Получаем ссылку для скачивания
        download_url = get_download_link(file_path, public_key)
        
        # Скачиваем файл
        response = requests.get(download_url, timeout=60)
        
        if response.status_code == 200:
            file_content = response.content
            
            # Если указан путь для сохранения, сохраняем файл
            if save_path:
                with open(save_path, 'wb') as f:
                    f.write(file_content)
            
            return file_content
        else:
            raise Exception(f"Ошибка скачивания файла: {response.status_code}")
    
    except Exception as e:
        raise Exception(f"Ошибка при скачивании файла: {str(e)}")

def format_file_size(size_bytes: int) -> str:
    """Форматировать размер файла в читаемый вид"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)
    
    while size >= 1024 and i < len(size_names) - 1:
        size /= 1024
        i += 1
    
    return f"{size:.2f} {size_names[i]}"

def format_date(date_string: str) -> str:
    """Форматировать дату в читаемый вид"""
    try:
        # Формат даты от Яндекс Диска: "2025-11-09T12:34:56+00:00"
        dt = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
        return dt.strftime('%d.%m.%Y %H:%M')
    except:
        return date_string

def get_public_folder_contents(public_key: str, path: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Получить список файлов из публичной папки Яндекс Диска (без OAuth токена)
    
    Args:
        public_key: Публичный ключ папки (из URL: https://disk.yandex.ru/d/{public_key})
        path: Путь к файлу/папке внутри публичной папки (опционально)
    
    Returns:
        Список словарей с информацией о файлах и папках
    """
    try:
        # ВАЖНО: API требует полную ссылку, а не только ключ!
        public_url = f"https://disk.yandex.ru/d/{public_key}"
        url = f"{YANDEX_DISK_API_BASE}/public/resources"
        params = {
            'public_key': public_url,  # Полная ссылка!
            'limit': 1000,
            'sort': '-modified'
        }
        
        # Если указан путь внутри папки, добавляем его
        if path:
            params['path'] = path
        
        # Для публичных папок не нужен OAuth токен
        headers = {
            'Accept': 'application/json'
        }
        
        response = requests.get(url, headers=headers, params=params, timeout=60)  # Увеличено до 60 секунд для больших папок
        
        if response.status_code == 200:
            data = response.json()
            items = data.get('_embedded', {}).get('items', [])
            
            # Форматируем данные для удобства использования
            formatted_items = []
            for item in items:
                formatted_item = {
                    'name': item.get('name', ''),
                    'path': item.get('path', ''),
                    'type': item.get('type', 'file'),  # 'file' или 'dir'
                    'size': item.get('size', 0),
                    'modified': item.get('modified', ''),
                    'created': item.get('created', ''),
                    'mime_type': item.get('mime_type', ''),
                    'preview': item.get('preview', ''),
                    'file': item.get('file', ''),
                    'public_url': item.get('public_url', ''),
                    'public_key': public_key  # Сохраняем публичный ключ для скачивания
                }
                formatted_items.append(formatted_item)
            
            return formatted_items
        elif response.status_code == 404:
            raise ValueError(f"Публичная папка не найдена: {public_key}")
        else:
            error_data = response.json() if response.content else {}
            error_message = error_data.get('message', f'Ошибка API: {response.status_code}')
            raise Exception(f"Ошибка получения списка файлов из публичной папки: {error_message}")
    
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ошибка подключения к API Яндекс Диска: {str(e)}")
    except Exception as e:
        raise Exception(f"Ошибка при получении списка файлов из публичной папки: {str(e)}")

def get_public_download_link(public_key: str, file_path: str) -> str:
    """
    Получить прямую ссылку для скачивания файла из публичной папки
    
    Args:
        public_key: Публичный ключ папки
        file_path: Путь к файлу внутри публичной папки
    
    Returns:
        URL для скачивания файла
    """
    try:
        # ВАЖНО: API требует полную ссылку, а не только ключ!
        public_url = f"https://disk.yandex.ru/d/{public_key}"
        
        # Для публичных папок путь должен быть относительным (без начального /)
        # Убираем начальный слэш, если он есть
        relative_path = file_path.lstrip('/')
        
        url = f"{YANDEX_DISK_API_BASE}/public/resources/download"
        params = {
            'public_key': public_url,  # Полная ссылка!
            'path': relative_path  # Относительный путь без начального /
        }
        
        headers = {
            'Accept': 'application/json'
        }
        
        response = requests.get(url, headers=headers, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            download_url = data.get('href', '')
            if not download_url:
                raise Exception("API не вернул ссылку для скачивания")
            return download_url
        elif response.status_code == 404:
            raise ValueError(f"Файл не найден в публичной папке: {relative_path} (исходный путь: {file_path})")
        else:
            error_data = response.json() if response.content else {}
            error_message = error_data.get('message', f'Ошибка API: {response.status_code}')
            raise Exception(f"Ошибка получения ссылки для скачивания: {error_message}")
    
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ошибка подключения к API Яндекс Диска: {str(e)}")
    except Exception as e:
        raise Exception(f"Ошибка при получении ссылки для скачивания: {str(e)}")

def get_public_view_link(public_key: str, file_path: str) -> str:
    """
    Получить ссылку для просмотра файла из публичной папки (вместо скачивания)
    
    Args:
        public_key: Публичный ключ папки
        file_path: Путь к файлу внутри публичной папки
    
    Returns:
        URL для просмотра файла в браузере
    """
    try:
        # Для публичных папок используем прямую ссылку на файл
        # Формат: https://disk.yandex.ru/d/{public_key}?path={file_path}
        public_url = f"https://disk.yandex.ru/d/{public_key}"
        
        # Кодируем путь к файлу
        from urllib.parse import quote
        encoded_path = quote(file_path, safe='')
        
        # Возвращаем ссылку для просмотра
        view_url = f"{public_url}?path={encoded_path}"
        return view_url
    
    except Exception as e:
        raise Exception(f"Ошибка при получении ссылки для просмотра: {str(e)}")

def get_view_link(file_path: str, public_key: Optional[str] = None) -> str:
    """
    Получить ссылку для просмотра файла
    Поддерживает как обычные папки (с OAuth токеном), так и публичные папки (без токена)
    
    Args:
        file_path: Путь к файлу на Яндекс Диске
        public_key: Публичный ключ папки (если используется публичная папка)
    
    Returns:
        URL для просмотра файла в браузере
    """
    try:
        # Если указан публичный ключ, используем публичный API
        if public_key:
            return get_public_view_link(public_key, file_path)
        
        # Проверяем, используется ли публичная папка по умолчанию
        default_public_key = get_yandex_disk_public_key()
        if default_public_key:
            return get_public_view_link(default_public_key, file_path)
        
        # Работа с обычной папкой (требуется OAuth токен)
        # Нормализуем путь: убираем префикс "disk:" если есть
        if file_path.startswith('disk:'):
            file_path = file_path[5:]  # Убираем "disk:"
        
        # Нормализуем путь
        file_path = file_path.strip('/')
        if not file_path.startswith('/'):
            file_path = f'/{file_path}'
        
        # Получаем информацию о файле для получения preview ссылки
        url = f"{YANDEX_DISK_API_BASE}/resources"
        params = {
            'path': file_path,
            'preview_size': 'M'  # Размер превью
        }
        
        headers = get_headers()
        response = requests.get(url, headers=headers, params=params, timeout=60)
        
        if response.status_code == 200:
            data = response.json()
            # Пробуем использовать preview ссылку, если доступна
            preview = data.get('preview', '')
            if preview:
                return preview
            
            # Если preview нет, создаем прямую ссылку на Яндекс Диск
            # Формат: https://disk.yandex.ru/client/disk/{path}
            from urllib.parse import quote
            encoded_path = quote(file_path, safe='')
            view_url = f"https://disk.yandex.ru/client/disk{encoded_path}"
            return view_url
        elif response.status_code == 401:
            raise ValueError("Неверный OAuth токен или токен истек")
        elif response.status_code == 403:
            raise ValueError("Нет доступа к файлу")
        elif response.status_code == 404:
            raise ValueError(f"Файл не найден: {file_path}")
        else:
            error_data = response.json() if response.content else {}
            error_message = error_data.get('message', f'Ошибка API: {response.status_code}')
            raise Exception(f"Ошибка получения ссылки для просмотра: {error_message}")
    
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ошибка подключения к API Яндекс Диска: {str(e)}")
    except Exception as e:
        raise Exception(f"Ошибка при получении ссылки для просмотра: {str(e)}")

