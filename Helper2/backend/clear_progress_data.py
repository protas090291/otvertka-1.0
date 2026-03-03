#!/usr/bin/env python3
"""
Скрипт для полной очистки данных из таблицы progress_data
Удаляет все записи о работах и прогрессе
"""

import os
import sys
import requests
from dotenv import load_dotenv
from pathlib import Path

# Загружаем переменные окружения
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Используем значения из .env или значения по умолчанию из проекта
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "https://yytqmdanfcwfqfqruvta.supabase.co"
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or 
    os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY") or 
    os.getenv("SUPABASE_ANON_KEY") or 
    os.getenv("VITE_SUPABASE_ANON_KEY") or
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dHFtZGFuZmN3ZnFmcXJ1dnRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzUzMzM0MSwiZXhwIjoyMDczMTA5MzQxfQ.ni200CDPDR225aDJhBHQXh17t0fnX8bXuzYflOTPYnM"
)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Ошибка: Не удалось определить SUPABASE_URL или SUPABASE_KEY")
    sys.exit(1)

def get_count():
    """Получить количество записей в таблице"""
    url = f"{SUPABASE_URL}/rest/v1/progress_data"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "count=exact"
    }
    
    # Получаем все записи для точного подсчета
    response = requests.get(url, headers=headers, params={"select": "id"})
    
    if response.status_code == 200:
        data = response.json()
        return len(data)
    
    # Пробуем получить из заголовка
    count = response.headers.get("content-range", "0")
    if "/" in count:
        total = int(count.split("/")[1])
        return total
    return 0

def clear_all_data():
    """Удаление всех данных из таблицы progress_data"""
    print("🔗 Подключение к Supabase...")
    print(f"   URL: {SUPABASE_URL[:30]}...")
    
    # Сначала получаем количество записей
    print("\n📊 Проверка текущих данных...")
    count = get_count()
    print(f"   Найдено записей: {count}")
    
    if count == 0:
        print("\n✅ Таблица уже пуста, нечего удалять.")
        return 0
    
    # Подтверждение
    print(f"\n⚠️  ВНИМАНИЕ: Будет удалено {count} записей из таблицы progress_data!")
    print("   Это действие нельзя отменить.")
    
    # Удаляем все записи
    print("\n🗑️  Удаление всех записей...")
    url = f"{SUPABASE_URL}/rest/v1/progress_data"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # Получаем все ID с пагинацией
        all_ids = []
        from_idx = 0
        page_size = 1000
        has_more = True
        
        while has_more:
            headers_with_range = headers.copy()
            headers_with_range['Range'] = f'{from_idx}-{from_idx + page_size - 1}'
            get_response = requests.get(
                url,
                headers=headers_with_range,
                params={"select": "id"}
            )
            
            if get_response.status_code in [200, 206]:
                data = get_response.json()
                if data and len(data) > 0:
                    all_ids.extend([record["id"] for record in data])
                    from_idx += page_size
                    content_range = get_response.headers.get('Content-Range', '')
                    if content_range:
                        parts = content_range.split('/')
                        if len(parts) == 2:
                            total = int(parts[1])
                            has_more = from_idx < total
                        else:
                            has_more = len(data) == page_size
                    else:
                        has_more = len(data) == page_size
                else:
                    has_more = False
            else:
                break
        
        print(f"   Найдено ID для удаления: {len(all_ids)}")
        
        # Удаляем батчами по 100 записей
        deleted = 0
        batch_size = 100
        for i in range(0, len(all_ids), batch_size):
            batch_ids = all_ids[i:i+batch_size]
            # Удаляем через фильтр по ID
            for record_id in batch_ids:
                delete_response = requests.delete(
                    url,
                    headers=headers,
                    params={"id": f"eq.{record_id}"},
                    timeout=30
                )
                if delete_response.status_code in [200, 204]:
                    deleted += 1
            
            print(f"   Удалено: {deleted}/{len(all_ids)}", end="\r")
        
        print(f"\n   Удалено записей: {deleted}")
        
        # Проверяем результат
        print("\n🔍 Проверка результата...")
        new_count = get_count()
        if new_count == 0:
            print(f"✅ Подтверждение: таблица полностью очищена!")
            return 0
        else:
            print(f"⚠️  Предупреждение: осталось записей: {new_count}")
            print("   Попробуйте удалить оставшиеся записи вручную через интерфейс Supabase")
            return 1
            
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    try:
        exit_code = clear_all_data()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Операция отменена пользователем")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
