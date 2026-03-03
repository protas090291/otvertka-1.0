#!/usr/bin/env python3
import requests
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "https://yytqmdanfcwfqfqruvta.supabase.co"
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or 
    os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY") or 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dHFtZGFuZmN3ZnFmcXJ1dnRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzUzMzM0MSwiZXhwIjoyMDczMTA5MzQxfQ.ni200CDPDR225aDJhBHQXh17t0fnX8bXuzYflOTPYnM"
)

url = f'{SUPABASE_URL}/rest/v1/progress_data'
headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Prefer': 'count=exact'
}

# Получаем все данные с пагинацией через Range заголовки
all_data = []
from_idx = 0
page_size = 1000
has_more = True

while has_more:
    headers_with_range = headers.copy()
    headers_with_range['Range'] = f'{from_idx}-{from_idx + page_size - 1}'
    
    response = requests.get(
        url, 
        headers=headers_with_range, 
        params={'select': '*'}
    )
    
    if response.status_code in [200, 206]:  # 206 = Partial Content
        data = response.json()
        if data and len(data) > 0:
            all_data.extend(data)
            from_idx += page_size
            # Проверяем, есть ли еще данные
            content_range = response.headers.get('Content-Range', '')
            if content_range:
                # Формат: "0-999/2397" - если последнее число больше текущего индекса, есть еще
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
        print(f'Ошибка: {response.status_code} - {response.text[:200]}')
        break

data = all_data
if data:
    unique_tasks = set((r['task_name'], r['section']) for r in data)
    unique_apartments = set(r['apartment_id'] for r in data)
    
    print(f'📊 СТАТИСТИКА ИМПОРТА:')
    print(f'   Всего записей в БД: {len(data)}')
    print(f'   Уникальных работ: {len(unique_tasks)}')
    print(f'   Уникальных квартир: {len(unique_apartments)}')
    
    # Проверяем записи с ненулевыми процентами
    with_progress = [r for r in data if r.get('fact_progress', 0) > 0 or r.get('plan_progress', 0) > 0]
    print(f'   Записей с ненулевыми процентами: {len(with_progress)}')
    
    print(f'\n📋 Работы по разделам:')
    by_section = {}
    for task, section in unique_tasks:
        if section not in by_section:
            by_section[section] = []
        by_section[section].append(task)
    for section, tasks in sorted(by_section.items()):
        print(f'   {section}: {len(tasks)} работ')
        # Показываем все работы для проверки
        for i, task in enumerate(sorted(tasks), 1):
            print(f'      {i}. {task}')
    
    print(f'\n🏠 Квартиры ({len(unique_apartments)} шт.):')
    for apt in sorted(list(unique_apartments)):
        print(f'   {apt}')
else:
    print(f'Ошибка: данные не загружены')
