#!/usr/bin/env python3
"""
Скрипт для импорта структуры прогресса: все разделы, работы и квартиры
Проценты устанавливаются в 0 (пользователь проставит их самостоятельно)
"""

import os
import sys
import requests
from dotenv import load_dotenv
from pathlib import Path

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

# Все квартиры (51 квартира)
ALL_APARTMENTS = [
    'T101', 'T201', 'T202-И', 'T203', 'T301', 'T302', 'T303',
    'T401', 'T402', 'T403-И', 'T404',
    'T501', 'T502', 'T503-И', 'T504-И',
    'T601', 'T602', 'T603', 'T604',
    'T701', 'T702-И', 'T703-И', 'T704-И',
    'T801-И', 'T802', 'T803', 'T804',
    'T901', 'T902-И', 'T903', 'T904',
    'T1001', 'T1002', 'T1003', 'T1004',
    'T1101', 'T1102', 'T1103', 'T1104',
    'T1201', 'T1202', 'T1203-И', 'T1204',
    'T1301-И', 'T1302', 'T1401',
    'У501', 'У502', 'У503', 'У504', 'У704'
]

def normalize_apartment_id(apt_id):
    """Нормализация ID квартиры (убираем суффикс -И)"""
    return apt_id.replace("-И", "").strip()

# Структура работ по разделам (точный согласованный список в правильном порядке)
WORK_STRUCTURE = {
    "Отделочные работы": [
        "Устройство металлического каркаса перегородок и стен",
        "Монтаж гипсокартона под стяжку (400 мм от пола)",
        "Гидроизоляция пола в санузлах под конвекторами",
        "Гидроизоляция общая",
        "Заливка стяжки из пенополистирол бетона",
        "Заливка чистовой стяжки",
        "Шумоизоляция стен",
        "Обшивка каркаса листами ГКЛ стен",
        "Обшивка каркаса листами ГКЛ потолков",
        "Шпаклевка стен (база)",
        "Шпаклевка потолка (база)",
        "Гидроизоляция обмазочная",
        "Кладка камня на стенах",
        "Кладка камня на полу",
        "Укладка фанеры на пол"
    ],
    "Работы по ОВК": [
        # Работы по Механическим системам (8 работ)
        "Монтаж воздуховодов систем вентиляции",
        "Монтаж наружных блоков кондиционеров",
        "Монтаж внутренних блоков кондиционеров",
        "Монтаж дренажа",
        "Монтаж фреонопровода",
        "Монтаж вентустановки",
        "Монтаж вентрешеток",
        "ПНР систем ОВИК",
        # Сантехнические работы (11 работ)
        "Монтаж черновой сантехники",
        "Монтаж трубопроводов водоснабжения",
        "Сборка сантехнических шкафов",
        "Монтаж трубопроводов канализации",
        "Монтаж санфаянса, сифонов и смесителей",
        "Монтаж душевых перегородок",
        "ПНР системы водоснабжения",
        "Демонтаж/монтаж внутрипольных конвекторов",
        "Демонтаж/монтаж трубопроводов отопления",
        "Монтаж коллекторного шкафа отопления",
        "ПНР системы отопления"
    ],
    "Работы по ЭОМ+АСУ": [
        "Монтаж кабельных трасс по потолку",
        "Монтаж кабельных трасс по полу",
        "Установка щитов и лотоков",
        "Завод кабеля в щит с потолка",
        "Завод кабеля в щит с пола",
        "Наращивание кабеля на воронку",
        "Завод кабеля в щит приходящих с МОП",
        "Монтаж заземления инсталляции",
        "Установка закладных для датчиков теплого пола",
        "Монтаж подрозетников в санузлах для вывода датчика протечки",
        "Монтаж силового щита",
        "Монтаж слаботочного щита",
        "Монтаж КУП"
    ]
}

def prepare_all_records():
    """Подготовка всех записей для импорта"""
    records = []
    
    for section, tasks in WORK_STRUCTURE.items():
        for task_name in tasks:
            for apartment_id in ALL_APARTMENTS:
                normalized_apt = normalize_apartment_id(apartment_id)
                records.append({
                    "task_name": task_name,
                    "section": section,
                    "apartment_id": normalized_apt,
                    "fact_progress": 0,  # Пользователь проставит сам
                    "plan_progress": 0,  # Пользователь проставит сам
                    "updated_by": "Система (импорт структуры)"
                })
    
    return records

def import_batch(records_batch):
    """Импорт батча записей через Supabase REST API"""
    url = f"{SUPABASE_URL}/rest/v1/progress_data"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
    
    try:
        response = requests.post(
            url,
            json=records_batch,
            headers=headers,
            timeout=30,
            params={"on_conflict": "task_name,section,apartment_id"}
        )
        
        if response.status_code in [200, 201, 204]:
            try:
                result = response.json()
                return True, result if isinstance(result, list) else records_batch
            except ValueError:
                return True, records_batch
        else:
            error_text = response.text[:500] if response.text else "Пустой ответ"
            return False, f"HTTP {response.status_code}: {error_text}"
    except Exception as e:
        return False, f"Ошибка запроса: {str(e)}"

def main():
    print("🚀 Начало импорта структуры прогресса...")
    print(f"🔗 Подключение к Supabase: {SUPABASE_URL[:30]}...")
    
    # Подготавливаем данные
    records = prepare_all_records()
    total_records = len(records)
    
    print(f"\n📊 Структура для импорта:")
    for section, tasks in WORK_STRUCTURE.items():
        print(f"   {section}: {len(tasks)} работ")
    print(f"   Квартир: {len(ALL_APARTMENTS)}")
    print(f"   Всего записей: {total_records}")
    
    # Разбиваем на батчи по 100 записей
    BATCH_SIZE = 100
    total_imported = 0
    total_failed = 0
    
    print(f"\n📦 Импорт данных...")
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        total_batches = (len(records) + BATCH_SIZE - 1) // BATCH_SIZE
        
        print(f"   Батч {batch_num}/{total_batches} ({len(batch)} записей)...", end=" ")
        
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
    print(f"   Всего обработано: {total_records}")
    print("=" * 60)
    
    if total_failed == 0:
        print("\n✅ Все данные успешно импортированы!")
        print("💡 Теперь вы можете проставить проценты вручную через интерфейс")
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
