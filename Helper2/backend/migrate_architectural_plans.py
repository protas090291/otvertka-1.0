#!/usr/bin/env python3
"""
Миграция архитектурных планов из Яндекс.Диска в Supabase Storage
Автоматически находит последние версии планов в структуре папок
"""

import os
import sys
import re
import requests
from pathlib import Path
from typing import Optional, Dict, Tuple, List
from datetime import datetime, timedelta
from urllib.parse import quote
from dotenv import load_dotenv

# Таблица транслитерации кириллицы в латиницу
CYRILLIC_TO_LATIN = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
}

def transliterate_filename(filename: str) -> str:
    """Транслитерирует имя файла из кириллицы в латиницу для Storage"""
    result = []
    for char in filename:
        if char in CYRILLIC_TO_LATIN:
            result.append(CYRILLIC_TO_LATIN[char])
        else:
            result.append(char)
    return ''.join(result)

# Импортируем функции для работы с Яндекс.Диском
from yandex_disk_api import get_folder_contents, download_file, get_yandex_disk_public_key

# Загружаем переменные окружения
script_dir = Path(__file__).parent
env_path = script_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

# Также загружаем из корневой директории проекта, если есть
root_env = Path(__file__).parent.parent / ".env"
if root_env.exists():
    load_dotenv(dotenv_path=root_env)

# Загружаем из текущей директории
load_dotenv(override=False)

# Настройки Supabase (используем значения по умолчанию, если не найдены в .env)
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "https://yytqmdanfcwfqfqruvta.supabase.co"
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or 
    os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY") or 
    os.getenv("SUPABASE_ANON_KEY") or 
    os.getenv("VITE_SUPABASE_ANON_KEY") or
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dHFtZGFuZmN3ZnFmcXJ1dnRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzUzMzM0MSwiZXhwIjoyMDczMTA5MzQxfQ.ni200CDPDR225aDJhBHQXh17t0fnX8bXuzYflOTPYnM"
)

BUCKET_NAME = "architectural-plans"

# Базовый путь к папке с планами (относительно корневой папки Яндекс.Диска)
BASE_PATH = "/Вишневый_сад-3_для_Заказчика/1. РД/РД в процессе производства"


def extract_building_and_apartment_from_filename(filename: str) -> Optional[Tuple[str, str]]:
    """
    Извлекает корпус и номер квартиры из имени файла
    Поддерживает форматы: T401_АИ, T401, У501, У-501, T0101, Т0101 и т.д.
    Нормализует номер квартиры: убирает ведущие нули (0101 -> 101, но 1001 остается 1001)
    """
    # Убираем расширение файла
    name_without_ext = os.path.splitext(filename)[0]
    
    # Паттерн: корпус (Т/У/T/U) + номер квартиры (может быть с ведущими нулями)
    match = re.match(r'^([ТУTU])(\d+)', name_without_ext)
    
    if match:
        building_char = match.group(1)
        apartment_num = match.group(2)
        
        # Нормализуем номер квартиры
        # Если номер 4-значный и начинается с 0 (например, 0101), убираем первый 0 -> 101
        # Если номер 3-значный (101), оставляем как есть
        # Если номер 4-значный без ведущего нуля (1001), оставляем как есть
        if len(apartment_num) == 4 and apartment_num.startswith('0'):
            # Это была квартира с ведущим нулем (0101 -> 101)
            apartment_num_normalized = apartment_num[1:]  # Убираем только первый ноль
        else:
            # Оставляем как есть (101, 1001, 1101 и т.д.)
            apartment_num_normalized = apartment_num
        
        # Преобразуем в единый формат: Т или У
        if building_char.upper() in ['Т', 'T']:
            building = 'T'
        elif building_char.upper() in ['У', 'U']:
            building = 'U'
        else:
            return None
        
        return (building, apartment_num_normalized)
    
    return None


def parse_version_folder(folder_name: str) -> Optional[datetime]:
    """
    Парсит дату из названия папки версии
    Форматы: "13_изм_от_20.10.25", "13_изм от 20.10.25", "01_изм. от 01.07.25"
    """
    # Ищем паттерн с датой
    match = re.search(r'(\d{2})\.(\d{2})\.(\d{2})', folder_name)
    if match:
        day, month, year = match.groups()
        # Преобразуем год (25 -> 2025)
        full_year = 2000 + int(year)
        try:
            return datetime(full_year, int(month), int(day))
        except ValueError:
            return None
    
    # Альтернативный формат: ищем номер версии
    match = re.match(r'^(\d+)_', folder_name)
    if match:
        # Если нет даты, используем номер версии (больше = новее)
        version_num = int(match.group(1))
        # Возвращаем дату с номером версии (для сортировки)
        return datetime(2000, 1, 1) + timedelta(days=version_num)
    
    return None


def find_latest_version_folder(folders: List[Dict]) -> Optional[Dict]:
    """
    Находит последнюю (самую актуальную) папку с изменениями
    """
    version_folders = []
    
    for folder in folders:
        if folder.get('type') != 'dir':
            continue
        
        folder_name = folder.get('name', '')
        # Проверяем, что это папка с версией (содержит "изм" или начинается с цифры)
        if 'изм' in folder_name.lower() or re.match(r'^\d+_', folder_name):
            version_date = parse_version_folder(folder_name)
            if version_date:
                version_folders.append((version_date, folder))
    
    if not version_folders:
        return None
    
    # Сортируем по дате (последняя = самая новая)
    version_folders.sort(key=lambda x: x[0], reverse=True)
    return version_folders[0][1]


def find_apartment_plans_folder(folders: List[Dict], apartment_number: str) -> Optional[Dict]:
    """
    Находит папку с планами квартиры (например, "T401 РД АР-по листам")
    """
    for folder in folders:
        if folder.get('type') != 'dir':
            continue
        
        folder_name = folder.get('name', '')
        # Ищем папку, которая содержит номер квартиры и "АР" или "РД"
        if apartment_number in folder_name and ('АР' in folder_name or 'РД' in folder_name):
            return folder
    
    return None


def find_apartment_ap_folder(folders: List[Dict], apartment_number: str) -> Optional[Dict]:
    """
    Находит папку "T401 AP" (или похожую) для квартиры
    Учитывает варианты с ведущим нулем (0101) и без (101)
    """
    # Создаем список вариантов номера квартиры для поиска
    search_variants = [apartment_number]
    
    # Если номер 3-значный (101, 201 и т.д.), добавляем вариант с ведущим нулем (0101)
    if len(apartment_number) == 3:
        search_variants.append('0' + apartment_number)
    # Если номер 4-значный и начинается с 0 (0101), добавляем вариант без нуля (101)
    elif len(apartment_number) == 4 and apartment_number.startswith('0'):
        search_variants.append(apartment_number[1:])
    
    for folder in folders:
        if folder.get('type') != 'dir':
            continue
        
        folder_name = folder.get('name', '')
        # Ищем папку, которая содержит номер квартиры (в любом варианте) и "AP" или "АР"
        for variant in search_variants:
            if variant in folder_name and ('AP' in folder_name or 'АР' in folder_name):
                return folder
    
    return None


def find_architectural_plan_pdfs(folder_path: str, apartment_number: str, max_depth: int = 5, current_depth: int = 0) -> List[Dict]:
    """
    Рекурсивно находит PDF файлы с архитектурными планами
    Фильтрует только файлы, которые содержат номер квартиры и "Архитектурный план" в названии
    Учитывает варианты с ведущим нулем (0101) и без (101)
    """
    if current_depth >= max_depth:
        return []
    
    pdf_files = []
    
    # Создаем список вариантов номера квартиры для поиска
    search_variants = [apartment_number]
    if len(apartment_number) == 3:
        search_variants.append('0' + apartment_number)
    elif len(apartment_number) == 4 and apartment_number.startswith('0'):
        search_variants.append(apartment_number[1:])
    
    try:
        items = get_folder_contents(folder_path)
        
        for item in items:
            if item.get('type') == 'file':
                filename = item.get('name', '')
                # Проверяем, что это PDF файл
                if filename.lower().endswith('.pdf'):
                    # Проверяем, что в имени файла есть номер квартиры (в любом варианте)
                    found_variant = False
                    for variant in search_variants:
                        if variant in filename:
                            found_variant = True
                            break
                    
                    if found_variant:
                        # Проверяем, что в имени файла есть "Архитектурный план" (с учетом разных регистров и вариантов)
                        filename_lower = filename.lower()
                        if 'архитектурный план' in filename_lower or 'архитектурный' in filename_lower:
                            pdf_files.append(item)
            elif item.get('type') == 'dir':
                # Рекурсивно ищем в подпапках
                subfolder_path = item.get('path', '')
                pdf_files.extend(find_architectural_plan_pdfs(subfolder_path, apartment_number, max_depth, current_depth + 1))
    
    except Exception as e:
        print(f"   ⚠️ Ошибка при поиске в {folder_path}: {e}")
    
    return pdf_files


def process_apartment_folder(apartment_folder_path: str, apartment_number: str) -> List[Dict]:
    """
    Обрабатывает папку квартиры, находит последнюю версию и извлекает PDF файлы с архитектурными планами
    """
    print(f"   📂 Обрабатываем папку квартиры: {apartment_folder_path}")
    
    # Получаем содержимое папки квартиры
    items = get_folder_contents(apartment_folder_path)
    
    # Ищем папку "T401 AP" (или похожую)
    ap_folder = find_apartment_ap_folder(items, apartment_number)
    if not ap_folder:
        print(f"   ⚠️ Не найдена папка AP для квартиры {apartment_number}")
        return []
    
    ap_folder_path = ap_folder.get('path', '')
    print(f"   📁 Найдена папка AP: {ap_folder.get('name', '')}")
    
    # Получаем содержимое папки AP
    ap_items = get_folder_contents(ap_folder_path)
    
    # Находим последнюю папку с изменениями
    latest_version = find_latest_version_folder(ap_items)
    
    if latest_version:
        # Есть папки с версиями - используем стандартный путь
        latest_version_path = latest_version.get('path', '')
        print(f"   ✅ Найдена последняя версия: {latest_version.get('name', '')}")
        
        # Получаем содержимое последней версии
        version_items = get_folder_contents(latest_version_path)
        
        # Ищем папку с планами "T401 РД АР-по листам"
        plans_folder = find_apartment_plans_folder(version_items, apartment_number)
        if not plans_folder:
            print(f"   ⚠️ Не найдена папка с планами для квартиры {apartment_number}")
            return []
        
        plans_folder_path = plans_folder.get('path', '')
        print(f"   📋 Найдена папка с планами: {plans_folder.get('name', '')}")
    else:
        # Нет папок с версиями - проверяем папку "РД АР-по листам" напрямую в папке AP
        print(f"   ⚠️ Не найдена папка с изменениями, проверяем папку 'РД АР-по листам' напрямую")
        plans_folder = find_apartment_plans_folder(ap_items, apartment_number)
        if not plans_folder:
            print(f"   ⚠️ Не найдена папка с планами для квартиры {apartment_number}")
            return []
        
        plans_folder_path = plans_folder.get('path', '')
        print(f"   📋 Найдена папка с планами: {plans_folder.get('name', '')}")
    
    # ВАЖНО: Находим только PDF файлы с архитектурными планами
    # (которые содержат номер квартиры и "Архитектурный план" в названии)
    pdf_files = find_architectural_plan_pdfs(plans_folder_path, apartment_number, max_depth=3)
    print(f"   📄 Найдено архитектурных планов: {len(pdf_files)}")
    
    if pdf_files:
        print(f"   📝 Файлы:")
        for pdf in pdf_files:
            print(f"      - {pdf.get('name', '')}")
    
    return pdf_files


def upload_to_supabase_storage(file_content: bytes, filename: str, supabase_url: str, supabase_key: str) -> Optional[str]:
    """Загружает файл в Supabase Storage"""
    try:
        # Транслитерируем имя файла для Storage (Supabase не поддерживает кириллицу в именах файлов)
        storage_filename = transliterate_filename(filename)
        
        # Кодируем путь для URL
        encoded_path = quote(storage_filename, safe='')
        upload_url = f"{supabase_url}/storage/v1/object/{BUCKET_NAME}/{encoded_path}"
        
        content_type = 'application/pdf' if filename.lower().endswith('.pdf') else 'application/octet-stream'
        
        headers = {
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': content_type,
            'x-upsert': 'true'
        }
        
        response = requests.post(upload_url, headers=headers, data=file_content)
        
        if response.status_code != 200:
            print(f"   ⚠️ Ответ сервера: {response.status_code} - {response.text[:200]}")
        
        response.raise_for_status()
        
        # Для публичного URL используем транслитерированное имя
        public_url = f"{supabase_url}/storage/v1/object/public/{BUCKET_NAME}/{encoded_path}"
        
        return public_url
        
    except Exception as e:
        print(f"   ❌ Ошибка загрузки {filename} в Storage: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   ⚠️ Детали ошибки: {e.response.text[:300]}")
        return None


def get_apartment_uuid(apartment_number: str, supabase_url: str, supabase_key: str) -> Optional[str]:
    """Получает UUID квартиры по номеру из таблицы apartments"""
    try:
        # Ищем квартиру по номеру
        search_url = f"{supabase_url}/rest/v1/apartments"
        headers = {
            'Authorization': f'Bearer {supabase_key}',
            'apikey': supabase_key,
            'Content-Type': 'application/json'
        }
        
        # Ищем по apartment_number
        params = {
            'apartment_number': f'eq.{apartment_number}',
            'select': 'id'
        }
        
        response = requests.get(search_url, headers=headers, params=params)
        response.raise_for_status()
        
        data = response.json()
        if data and len(data) > 0:
            return data[0].get('id')
        
        return None
    except Exception as e:
        return None


def save_to_database(filename: str, file_url: str, file_size: int, building: str, apartment_number: str, supabase_url: str, supabase_key: str) -> bool:
    """Сохраняет информацию о плане в таблицу architectural_plans"""
    try:
        # Получаем UUID квартиры
        apartment_uuid = get_apartment_uuid(apartment_number, supabase_url, supabase_key)
        
        if not apartment_uuid:
            # Если не нашли UUID, пропускаем сохранение в БД (система работает через Storage)
            print(f"   ⚠️ UUID квартиры {apartment_number} не найден, пропускаем сохранение в БД (система работает через Storage)")
            return True  # Возвращаем True, так как это не критическая ошибка
        
        plan_type = 'floor_plan'
        
        insert_url = f"{supabase_url}/rest/v1/architectural_plans"
        
        headers = {
            'Authorization': f'Bearer {supabase_key}',
            'apikey': supabase_key,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        }
        
        data = {
            'apartment_id': apartment_uuid,
            'plan_type': plan_type,
            'file_name': filename,
            'file_url': file_url,
            'file_size': file_size,
            'building': building
        }
        
        response = requests.post(insert_url, headers=headers, json=data)
        
        if response.status_code == 409:
            # Запись уже существует, обновляем
            update_url = f"{supabase_url}/rest/v1/architectural_plans"
            params = {
                'apartment_id': f'eq.{apartment_uuid}',
                'file_name': f'eq.{filename}'
            }
            response = requests.patch(update_url, headers=headers, json=data, params=params)
            response.raise_for_status()
            print(f"   ✅ Обновлено в БД: {filename}")
        elif response.status_code == 201 or response.status_code == 200:
            print(f"   ✅ Сохранено в БД: {filename}")
        else:
            print(f"   ⚠️ Неожиданный статус: {response.status_code}")
            print(f"   ⚠️ Ответ: {response.text[:300]}")
            response.raise_for_status()
        
        return True
        
    except requests.exceptions.HTTPError as e:
        print(f"   ⚠️ Ошибка сохранения {filename} в БД (не критично, система работает через Storage): {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   ⚠️ Детали: {e.response.text[:200]}")
        return True  # Возвращаем True, так как это не критическая ошибка
    except Exception as e:
        print(f"   ⚠️ Ошибка сохранения {filename} в БД (не критично): {e}")
        return True  # Возвращаем True, так как это не критическая ошибка


def migrate_plans_from_yandex_disk():
    """Основная функция миграции"""
    print("🚀 Начинаем миграцию архитектурных планов из Яндекс.Диска в Supabase...")
    print(f"📁 Базовый путь: {BASE_PATH}")
    print()
    
    try:
        # Получаем список папок квартир
        print("📥 Получаем список папок квартир...")
        base_items = get_folder_contents(BASE_PATH)
        
        # Фильтруем только папки (ищем папки типа "T0401 Classic" и т.д.)
        apartment_folders = []
        for item in base_items:
            if item.get('type') == 'dir':
                folder_name = item.get('name', '')
                # Извлекаем номер квартиры из имени папки
                match = re.match(r'^([ТУTU])(\d+)', folder_name)
                if match:
                    apartment_folders.append(item)
        
        print(f"📋 Найдено папок квартир: {len(apartment_folders)}")
        print()
        
        if not apartment_folders:
            print("⚠️ Папки квартир не найдены")
            return
        
        # Статистика
        uploaded_count = 0
        skipped_count = 0
        error_count = 0
        
        # Обрабатываем каждую папку квартиры
        for apartment_folder in apartment_folders:
            folder_name = apartment_folder.get('name', '')
            folder_path = apartment_folder.get('path', '')
            
            # Извлекаем корпус и номер квартиры
            building_info = extract_building_and_apartment_from_filename(folder_name)
            if not building_info:
                print(f"\n⚠️ Пропущена папка (не удалось определить корпус и номер): {folder_name}")
                skipped_count += 1
                continue
            
            building, apartment_number = building_info
            print(f"\n🏢 Квартира {building}{apartment_number} ({folder_name})")
            
            # Обрабатываем папку квартиры
            pdf_files = process_apartment_folder(folder_path, apartment_number)
            
            if not pdf_files:
                print(f"   ⚠️ Архитектурные планы не найдены для квартиры {building}{apartment_number}")
                skipped_count += 1
                continue
            
            # Обрабатываем каждый PDF файл
            for pdf_file in pdf_files:
                filename = pdf_file.get('name', '')
                file_path = pdf_file.get('path', '')
                file_size = pdf_file.get('size', 0)
                
                print(f"   📄 Обрабатываем: {filename}")
                
                # Проверяем, что файл относится к этой квартире
                file_building_info = extract_building_and_apartment_from_filename(filename)
                if not file_building_info or file_building_info != (building, apartment_number):
                    print(f"      ⚠️ Пропущен (не соответствует квартире)")
                    skipped_count += 1
                    continue
                
                try:
                    # Скачиваем файл
                    print(f"      ⬇️ Скачиваем...")
                    file_content = download_file(file_path)
                    
                    # Загружаем в Storage
                    print(f"      ⬆️ Загружаем в Storage...")
                    file_url = upload_to_supabase_storage(file_content, filename, SUPABASE_URL, SUPABASE_KEY)
                    
                    if not file_url:
                        error_count += 1
                        continue
                    
                    # Сохраняем в БД
                    print(f"      💾 Сохраняем в БД...")
                    if save_to_database(filename, file_url, file_size, building, apartment_number, SUPABASE_URL, SUPABASE_KEY):
                        uploaded_count += 1
                        print(f"      ✅ Готово!")
                    else:
                        error_count += 1
                        
                except Exception as e:
                    print(f"      ❌ Ошибка: {e}")
                    error_count += 1
        
        # Итоговая статистика
        print("\n" + "="*60)
        print("📊 ИТОГИ МИГРАЦИИ:")
        print("="*60)
        print(f"✅ Успешно загружено: {uploaded_count}")
        print(f"⚠️ Пропущено: {skipped_count}")
        print(f"❌ Ошибок: {error_count}")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    migrate_plans_from_yandex_disk()
