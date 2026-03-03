#!/usr/bin/env python3
"""
Простой скрипт для массового импорта данных прогресса
Использует HTTP запросы к Supabase REST API (не требует установки supabase-py)
"""

import os
import sys
import json
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

print(f"🔗 Подключение к Supabase: {SUPABASE_URL[:30]}...")

# Все квартиры из таблицы
ALL_APARTMENTS = [
    'T101', 'T201', 'T202', 'T203', 'T301', 'T302', 'T303',
    'T401', 'T402', 'T403', 'T404', 'T501', 'T502', 'T503', 'T504',
    'T601', 'T602', 'T603', 'T604', 'T701', 'T702', 'T703', 'T704',
    'T801', 'T802', 'T803', 'T804', 'T901', 'T902', 'T903',
    'T1001', 'T1002', 'T1003', 'T1004', 'T1101', 'T1102', 'T1103', 'T1104',
    'T1201', 'T1202', 'T1203', 'T1204', 'T1301', 'T1302', 'T1401',
    'Y501', 'Y502', 'Y503', 'Y504', 'Y704'
]

def normalize_apartment_id(apt_id):
    """Нормализация ID квартиры (убираем суффикс -И)"""
    return apt_id.replace("-И", "").strip()

def prepare_records():
    """Подготовка всех записей для импорта"""
    records = []
    
    # ОТДЕЛОЧНЫЕ РАБОТЫ
    for apt in ALL_APARTMENTS:
        normalized = normalize_apartment_id(apt)
        # Устройство металлического каркаса перегородок и стен - 100%
        records.append({
            "task_name": "Устройство металлического каркаса перегородок и стен",
            "section": "Отделочные работы",
            "apartment_id": normalized,
            "fact_progress": 100,
            "plan_progress": 100,
            "updated_by": "Система (массовый импорт)"
        })
        # Гидроизоляция общая - 0%
        records.append({
            "task_name": "Гидроизоляция общая",
            "section": "Отделочные работы",
            "apartment_id": normalized,
            "fact_progress": 0,
            "plan_progress": 100,
            "updated_by": "Система (массовый импорт)"
        })
    
    # РАБОТЫ ПО МЕХАНИЧЕСКИМ СИСТЕМАМ
    for apt in ALL_APARTMENTS:
        normalized = normalize_apartment_id(apt)
        records.append({
            "task_name": "Монтаж трубопроводов вентиляции",
            "section": "Работы по Механическим системам",
            "apartment_id": normalized,
            "fact_progress": 100,
            "plan_progress": 100,
            "updated_by": "Система (массовый импорт)"
        })
    
    # РАБОТЫ ПО ОТ+ВК
    for apt in ALL_APARTMENTS:
        normalized = normalize_apartment_id(apt)
        records.append({
            "task_name": "Монтаж систем отопления",
            "section": "Работы по ОТ+ВК",
            "apartment_id": normalized,
            "fact_progress": 100,
            "plan_progress": 100,
            "updated_by": "Система (массовый импорт)"
        })
    
    # РАБОТЫ ПО ЭОМ+АСУ
    for apt in ALL_APARTMENTS:
        normalized = normalize_apartment_id(apt)
        records.append({
            "task_name": "Монтаж кабеля в щит с пола",
            "section": "Работы по ЭОМ+АСУ",
            "apartment_id": normalized,
            "fact_progress": 100,
            "plan_progress": 100,
            "updated_by": "Система (массовый импорт)"
        })
        records.append({
            "task_name": "Монтаж кабеля в щит с потолка",
            "section": "Работы по ЭОМ+АСУ",
            "apartment_id": normalized,
            "fact_progress": 100,
            "plan_progress": 100,
            "updated_by": "Система (массовый импорт)"
        })
        records.append({
            "task_name": "Монтаж заземления инсталляции",
            "section": "Работы по ЭОМ+АСУ",
            "apartment_id": normalized,
            "fact_progress": 100,
            "plan_progress": 100,
            "updated_by": "Система (массовый импорт)"
        })
    
    return records

def import_batch(records_batch):
    """Импорт батча записей через Supabase REST API с upsert"""
    # Используем PATCH для upsert (обновление существующих или создание новых)
    url = f"{SUPABASE_URL}/rest/v1/progress_data"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
    
    try:
        # Используем POST с заголовком для upsert
        response = requests.post(
            url, 
            json=records_batch, 
            headers=headers, 
            timeout=30,
            params={"on_conflict": "task_name,section,apartment_id"}
        )
        
        # 409 (Conflict) может означать, что записи уже существуют, но это нормально при upsert
        if response.status_code in [200, 201, 204]:
            try:
                result = response.json()
                return True, result if isinstance(result, list) else records_batch
            except ValueError:
                # Если ответ не JSON, но статус успешный - считаем успехом
                return True, records_batch
        elif response.status_code == 409:
            # Конфликт - записи уже существуют, но это нормально
            # Попробуем обновить через PATCH
            return update_batch(records_batch)
        else:
            error_text = response.text[:500] if response.text else "Пустой ответ"
            return False, f"HTTP {response.status_code}: {error_text}"
    except Exception as e:
        return False, f"Ошибка запроса: {str(e)}"

def update_batch(records_batch):
    """Обновление существующих записей через PATCH"""
    url = f"{SUPABASE_URL}/rest/v1/progress_data"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    updated = 0
    for record in records_batch:
        try:
            # Обновляем каждую запись отдельно по уникальному ключу
            response = requests.patch(
                url,
                json=record,
                headers=headers,
                params={
                    "task_name": f"eq.{record['task_name']}",
                    "section": f"eq.{record['section']}",
                    "apartment_id": f"eq.{record['apartment_id']}"
                },
                timeout=10
            )
            if response.status_code in [200, 204]:
                updated += 1
        except:
            pass
    
    return True, updated

def main():
    print("🚀 Начало массового импорта данных прогресса...")
    
    # Подготавливаем данные
    records = prepare_records()
    print(f"📊 Подготовлено {len(records)} записей для импорта")
    
    # Разбиваем на батчи по 100 записей
    BATCH_SIZE = 100
    total_imported = 0
    total_failed = 0
    
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        total_batches = (len(records) + BATCH_SIZE - 1) // BATCH_SIZE
        
        print(f"📦 Обработка батча {batch_num}/{total_batches} ({len(batch)} записей)...", end=" ")
        
        success, result = import_batch(batch)
        
        if success:
            imported = len(result) if isinstance(result, list) else len(batch)
            total_imported += imported
            print(f"✅ Импортировано {imported} записей")
        else:
            total_failed += len(batch)
            print(f"❌ Ошибка: {result[:200]}")
    
    print("\n" + "=" * 60)
    print(f"✅ Импорт завершен!")
    print(f"   Успешно импортировано: {total_imported}")
    print(f"   Ошибок: {total_failed}")
    print(f"   Всего обработано: {len(records)}")
    print("=" * 60)
    
    if total_failed == 0:
        print("\n✅ Все данные успешно импортированы!")
        return 0
    else:
        print(f"\n⚠️ Импорт завершен с ошибками: {total_failed} записей не импортировано")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
