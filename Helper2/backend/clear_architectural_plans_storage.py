#!/usr/bin/env python3
"""
Скрипт для удаления всех архитектурных планов из Supabase Storage
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

def clear_architectural_plans_storage():
    """Удалить все архитектурные планы из Storage"""
    try:
        # Создаём клиент Supabase
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        
        # Получаем список всех файлов в bucket architectural-plans
        print("📂 Получаем список файлов в bucket 'architectural-plans'...")
        
        # Получаем все файлы (может потребоваться пагинация)
        all_files = []
        try:
            files = supabase.storage.from_("architectural-plans").list()
            if files:
                all_files.extend(files)
        except Exception as e:
            print(f"⚠️ Ошибка при получении списка файлов: {e}")
            return
        
        if not all_files:
            print("✅ Bucket 'architectural-plans' пуст или не существует")
            return
        
        print(f"📊 Найдено файлов: {len(all_files)}")
        
        # Удаляем все файлы
        deleted_count = 0
        failed_count = 0
        
        for file_info in all_files:
            file_name = file_info.get('name', '')
            if not file_name:
                continue
                
            try:
                result = supabase.storage.from_("architectural-plans").remove([file_name])
                deleted_count += 1
                print(f"  ✅ Удалён: {file_name}")
            except Exception as e:
                failed_count += 1
                print(f"  ❌ Ошибка удаления {file_name}: {e}")
        
        print(f"\n✅ Удалено файлов: {deleted_count} из {len(all_files)}")
        if failed_count > 0:
            print(f"❌ Ошибок при удалении: {failed_count}")
        
        # Проверяем результат
        try:
            remaining_files = supabase.storage.from_("architectural-plans").list()
            remaining_count = len(remaining_files) if remaining_files else 0
            print(f"📊 Осталось файлов: {remaining_count}")
        except Exception as e:
            print(f"⚠️ Не удалось проверить оставшиеся файлы: {e}")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    print("🗑️  Удаление всех архитектурных планов из Supabase Storage")
    print("=" * 60)
    
    response = input("⚠️  Вы уверены, что хотите удалить ВСЕ архитектурные планы из Storage? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ Операция отменена")
        sys.exit(0)
    
    print()
    clear_architectural_plans_storage()
    print("\n✅ Готово!")
