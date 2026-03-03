#!/usr/bin/env python3
"""
Скрипт для удаления всех фотографий дефектов из Supabase Storage
"""
import os
import sys
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

# Загружаем переменные окружения
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL") or 'https://yytqmdanfcwfqfqruvta.supabase.co'
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dHFtZGFuZmN3ZnFmcXJ1dnRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzUzMzM0MSwiZXhwIjoyMDczMTA5MzQxfQ.ni200CDPDR225aDJhBHQXh17t0fnX8bXuzYflOTPYnM'

def clear_defect_photos():
    """Удалить все фотографии дефектов из Storage"""
    try:
        # Создаём клиент Supabase
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        
        # Получаем список всех файлов в bucket defect-photos
        print("📂 Получаем список файлов в bucket 'defect-photos'...")
        files = supabase.storage.from_("defect-photos").list()
        
        if not files:
            print("✅ Bucket 'defect-photos' пуст или не существует")
            return
        
        print(f"📊 Найдено файлов: {len(files)}")
        
        # Удаляем все файлы
        deleted_count = 0
        for file_info in files:
            file_path = f"defect-photos/{file_info['name']}"
            try:
                result = supabase.storage.from_("defect-photos").remove([file_info['name']])
                deleted_count += 1
                print(f"  ✅ Удалён: {file_info['name']}")
            except Exception as e:
                print(f"  ❌ Ошибка удаления {file_info['name']}: {e}")
        
        print(f"\n✅ Удалено файлов: {deleted_count} из {len(files)}")
        
        # Проверяем результат
        remaining_files = supabase.storage.from_("defect-photos").list()
        print(f"📊 Осталось файлов: {len(remaining_files) if remaining_files else 0}")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("🗑️  Удаление всех фотографий дефектов из Supabase Storage")
    print("=" * 60)
    
    response = input("⚠️  Вы уверены, что хотите удалить ВСЕ фотографии дефектов? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ Операция отменена")
        sys.exit(0)
    
    clear_defect_photos()
    print("\n✅ Готово!")
