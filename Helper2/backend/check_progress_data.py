#!/usr/bin/env python3
"""
Скрипт для проверки данных в таблице progress_data
"""

import os
import sys
import requests
from dotenv import load_dotenv
from pathlib import Path
from collections import defaultdict

# Загружаем переменные окружения
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "https://yytqmdanfcwfqfqruvta.supabase.co"
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or 
    os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY") or 
    os.getenv("SUPABASE_ANON_KEY") or 
    os.getenv("VITE_SUPABASE_ANON_KEY") or
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dHFtZGFuZmN3ZnFmcXJ1dnRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzUzMzM0MSwiZXhwIjoyMDczMTA5MzQxfQ.ni200CDPDR225aDJhBHQXh17t0fnX8bXuzYflOTPYnM"
)

def check_data():
    """Проверка данных в таблице"""
    url = f"{SUPABASE_URL}/rest/v1/progress_data"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "count=exact"
    }
    
    # Получаем все данные
    response = requests.get(url, headers=headers, params={"select": "*", "limit": 1000})
    
    if response.status_code != 200:
        print(f"❌ Ошибка: HTTP {response.status_code}")
        print(response.text[:500])
        return
    
    data = response.json()
    count = len(data)
    
    print(f"📊 Найдено записей: {count}\n")
    
    if count == 0:
        print("✅ Таблица пуста")
        return
    
    # Группируем по разделам
    by_section = defaultdict(list)
    by_task = defaultdict(int)
    
    for record in data:
        section = record.get('section', 'Неизвестно')
        task = record.get('task_name', 'Неизвестно')
        by_section[section].append(record)
        by_task[f"{section} | {task}"] += 1
    
    print("=" * 60)
    print("📋 СТАТИСТИКА ПО РАЗДЕЛАМ:")
    print("=" * 60)
    for section, records in sorted(by_section.items()):
        print(f"\n🔹 {section}: {len(records)} записей")
        tasks = set(r.get('task_name') for r in records)
        print(f"   Работ: {len(tasks)}")
        for task in sorted(tasks)[:5]:  # Показываем первые 5
            print(f"      - {task}")
        if len(tasks) > 5:
            print(f"      ... и еще {len(tasks) - 5} работ")
    
    print("\n" + "=" * 60)
    print("📋 ВСЕ РАБОТЫ:")
    print("=" * 60)
    for key in sorted(by_task.keys()):
        section, task = key.split(" | ", 1)
        print(f"  {section} → {task} ({by_task[key]} записей)")

if __name__ == "__main__":
    try:
        check_data()
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
