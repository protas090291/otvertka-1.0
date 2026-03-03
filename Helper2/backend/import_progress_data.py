"""
Скрипт для массового импорта данных прогресса из таблицы
Использует Supabase для прямой вставки данных
Может анализировать изображение через AI или использовать предустановленные данные
"""

import os
import sys
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client
from typing import List, Dict, Any, Optional
import logging
import base64
import requests

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Загружаем переменные окружения
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Получаем данные Supabase из переменных окружения
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Не указаны SUPABASE_URL или SUPABASE_KEY в .env файле")
    sys.exit(1)

# Инициализация Supabase клиента
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Данные из таблицы прогресса
# Структура: {категория: {работа: {квартира: процент}}}
PROGRESS_DATA = {
    "Отделочные работы": {
        "Устройство металлического каркаса перегородок и стен": {
            "T101": 100, "T201": 100, "T202": 100, "T203": 100,
            "T301": 100, "T302": 100, "T303": 100,
            "T401": 100, "T402": 100, "T403": 100, "T404": 100,
            "T501": 100, "T502": 100, "T503": 100, "T504": 100,
            "T601": 100, "T602": 100, "T603": 100, "T604": 100,
            "T701": 100, "T702": 100, "T703": 100, "T704": 100,
            "T801": 100, "T802": 100, "T803": 100, "T804": 100,
            "T901": 100, "T902": 100, "T903": 100,
            "T1001": 100, "T1002": 100, "T1003": 100, "T1004": 100,
            "T1101": 100, "T1102": 100, "T1103": 100, "T1104": 100,
            "T1201": 100, "T1202": 100, "T1203": 100, "T1204": 100,
            "T1301": 100, "T1302": 100, "T1401": 100,
            "Y501": 100, "Y502": 100, "Y503": 100, "Y504": 100, "Y704": 100,
        },
        "Гидроизоляция общая": {
            "T101": 0, "T201": 0, "T202": 0, "T203": 0,
            "T301": 0, "T302": 0, "T303": 0,
            "T401": 0, "T402": 0, "T403": 0, "T404": 0,
            "T501": 0, "T502": 0, "T503": 0, "T504": 0,
            "T601": 0, "T602": 0, "T603": 0, "T604": 0,
            "T701": 0, "T702": 0, "T703": 0, "T704": 0,
            "T801": 0, "T802": 0, "T803": 0, "T804": 0,
            "T901": 0, "T902": 0, "T903": 0,
            "T1001": 0, "T1002": 0, "T1003": 0, "T1004": 0,
            "T1101": 0, "T1102": 0, "T1103": 0, "T1104": 0,
            "T1201": 0, "T1202": 0, "T1203": 0, "T1204": 0,
            "T1301": 0, "T1302": 0, "T1401": 0,
            "Y501": 0, "Y502": 0, "Y503": 0, "Y504": 0, "Y704": 0,
        },
    },
    "Работы по Механическим системам": {
        "Монтаж трубопроводов вентиляции": {
            "T101": 100, "T201": 100, "T202": 100, "T203": 100,
            "T301": 100, "T302": 100, "T303": 100,
            "T401": 100, "T402": 100, "T403": 100, "T404": 100,
            "T501": 100, "T502": 100, "T503": 100, "T504": 100,
            "T601": 100, "T602": 100, "T603": 100, "T604": 100,
            "T701": 100, "T702": 100, "T703": 100, "T704": 100,
            "T801": 100, "T802": 100, "T803": 100, "T804": 100,
            "T901": 100, "T902": 100, "T903": 100,
            "T1001": 100, "T1002": 100, "T1003": 100, "T1004": 100,
            "T1101": 100, "T1102": 100, "T1103": 100, "T1104": 100,
            "T1201": 100, "T1202": 100, "T1203": 100, "T1204": 100,
            "T1301": 100, "T1302": 100, "T1401": 100,
            "Y501": 100, "Y502": 100, "Y503": 100, "Y504": 100, "Y704": 100,
        },
    },
    "Работы по ОТ+ВК": {
        "Монтаж систем отопления": {
            "T101": 100, "T201": 100, "T202": 100, "T203": 100,
            "T301": 100, "T302": 100, "T303": 100,
            "T401": 100, "T402": 100, "T403": 100, "T404": 100,
            "T501": 100, "T502": 100, "T503": 100, "T504": 100,
            "T601": 100, "T602": 100, "T603": 100, "T604": 100,
            "T701": 100, "T702": 100, "T703": 100, "T704": 100,
            "T801": 100, "T802": 100, "T803": 100, "T804": 100,
            "T901": 100, "T902": 100, "T903": 100,
            "T1001": 100, "T1002": 100, "T1003": 100, "T1004": 100,
            "T1101": 100, "T1102": 100, "T1103": 100, "T1104": 100,
            "T1201": 100, "T1202": 100, "T1203": 100, "T1204": 100,
            "T1301": 100, "T1302": 100, "T1401": 100,
            "Y501": 100, "Y502": 100, "Y503": 100, "Y504": 100, "Y704": 100,
        },
    },
    "Работы по ЭОМ+АСУ": {
        "Монтаж кабеля в щит с пола": {
            "T101": 100, "T201": 100, "T202": 100, "T203": 100,
            "T301": 100, "T302": 100, "T303": 100,
            "T401": 100, "T402": 100, "T403": 100, "T404": 100,
            "T501": 100, "T502": 100, "T503": 100, "T504": 100,
            "T601": 100, "T602": 100, "T603": 100, "T604": 100,
            "T701": 100, "T702": 100, "T703": 100, "T704": 100,
            "T801": 100, "T802": 100, "T803": 100, "T804": 100,
            "T901": 100, "T902": 100, "T903": 100,
            "T1001": 100, "T1002": 100, "T1003": 100, "T1004": 100,
            "T1101": 100, "T1102": 100, "T1103": 100, "T1104": 100,
            "T1201": 100, "T1202": 100, "T1203": 100, "T1204": 100,
            "T1301": 100, "T1302": 100, "T1401": 100,
            "Y501": 100, "Y502": 100, "Y503": 100, "Y504": 100, "Y704": 100,
        },
        "Монтаж кабеля в щит с потолка": {
            "T101": 100, "T201": 100, "T202": 100, "T203": 100,
            "T301": 100, "T302": 100, "T303": 100,
            "T401": 100, "T402": 100, "T403": 100, "T404": 100,
            "T501": 100, "T502": 100, "T503": 100, "T504": 100,
            "T601": 100, "T602": 100, "T603": 100, "T604": 100,
            "T701": 100, "T702": 100, "T703": 100, "T704": 100,
            "T801": 100, "T802": 100, "T803": 100, "T804": 100,
            "T901": 100, "T902": 100, "T903": 100,
            "T1001": 100, "T1002": 100, "T1003": 100, "T1004": 100,
            "T1101": 100, "T1102": 100, "T1103": 100, "T1104": 100,
            "T1201": 100, "T1202": 100, "T1203": 100, "T1204": 100,
            "T1301": 100, "T1302": 100, "T1401": 100,
            "Y501": 100, "Y502": 100, "Y503": 100, "Y504": 100, "Y704": 100,
        },
        "Монтаж заземления инсталляции": {
            "T101": 100, "T201": 100, "T202": 100, "T203": 100,
            "T301": 100, "T302": 100, "T303": 100,
            "T401": 100, "T402": 100, "T403": 100, "T404": 100,
            "T501": 100, "T502": 100, "T503": 100, "T504": 100,
            "T601": 100, "T602": 100, "T603": 100, "T604": 100,
            "T701": 100, "T702": 100, "T703": 100, "T704": 100,
            "T801": 100, "T802": 100, "T803": 100, "T804": 100,
            "T901": 100, "T902": 100, "T903": 100,
            "T1001": 100, "T1002": 100, "T1003": 100, "T1004": 100,
            "T1101": 100, "T1102": 100, "T1103": 100, "T1104": 100,
            "T1201": 100, "T1202": 100, "T1203": 100, "T1204": 100,
            "T1301": 100, "T1302": 100, "T1401": 100,
            "Y501": 100, "Y502": 100, "Y503": 100, "Y504": 100, "Y704": 100,
        },
    },
}

def normalize_apartment_id(apartment_id: str) -> str:
    """Нормализация ID квартиры (убираем суффикс -И)"""
    return apartment_id.replace("-И", "").strip()

def prepare_data_for_import() -> List[Dict[str, Any]]:
    """Подготовка данных для импорта"""
    records = []
    
    for section, tasks in PROGRESS_DATA.items():
        for task_name, apartments in tasks.items():
            for apartment_id, progress in apartments.items():
                normalized_apt = normalize_apartment_id(apartment_id)
                records.append({
                    "task_name": task_name,
                    "section": section,
                    "apartment_id": normalized_apt,
                    "fact_progress": progress,
                    "plan_progress": 100,
                    "updated_by": "Система (массовый импорт)",
                })
    
    return records

def analyze_image_with_ai(image_path: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
    """Анализ изображения таблицы через AI"""
    if not image_path or not os.path.exists(image_path):
        return None
    
    try:
        logger.info(f"🔍 Анализ изображения через AI: {image_path}")
        
        # Читаем изображение
        with open(image_path, 'rb') as f:
            image_bytes = f.read()
        
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Используем анализатор таблиц
        from progress_table_analyzer import analyze_progress_table
        results = analyze_progress_table(image_base64)
        
        logger.info(f"✅ AI извлек {len(results)} записей из изображения")
        return results
        
    except Exception as e:
        logger.error(f"❌ Ошибка анализа изображения: {e}")
        return None

def import_progress_data(image_path: Optional[str] = None, use_ai: bool = True):
    """Массовый импорт данных прогресса"""
    logger.info("🚀 Начало импорта данных прогресса...")
    
    records = []
    
    # Пробуем использовать AI для анализа изображения
    if use_ai and image_path:
        ai_results = analyze_image_with_ai(image_path)
        if ai_results:
            # Конвертируем результаты AI в формат для импорта
            for result in ai_results:
                records.append({
                    "task_name": result["taskName"],
                    "section": result["section"],
                    "apartment_id": normalize_apartment_id(result["apartmentId"]),
                    "fact_progress": result["factProgress"],
                    "plan_progress": result.get("planProgress", 100),
                    "updated_by": "Система (AI импорт)",
                })
            logger.info(f"📊 Использованы данные из AI анализа: {len(records)} записей")
    
    # Если AI не дал результатов, используем предустановленные данные
    if not records:
        logger.info("📊 Использование предустановленных данных...")
        records = prepare_data_for_import()
    
    logger.info(f"📊 Всего подготовлено {len(records)} записей для импорта")
    
    # Разбиваем на батчи по 100 записей для избежания перегрузки
    BATCH_SIZE = 100
    total_imported = 0
    total_failed = 0
    
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        total_batches = (len(records) + BATCH_SIZE - 1) // BATCH_SIZE
        
        logger.info(f"📦 Обработка батча {batch_num}/{total_batches} ({len(batch)} записей)...")
        
        try:
            # Используем upsert для обновления существующих записей или создания новых
            response = supabase.table('progress_data').upsert(
                batch,
                on_conflict='task_name,section,apartment_id'
            ).execute()
            
            if response.data:
                imported = len(response.data)
                total_imported += imported
                logger.info(f"✅ Батч {batch_num}: импортировано {imported} записей")
            else:
                logger.warning(f"⚠️ Батч {batch_num}: ответ пустой")
                total_failed += len(batch)
                
        except Exception as e:
            logger.error(f"❌ Ошибка при импорте батча {batch_num}: {e}")
            total_failed += len(batch)
    
    logger.info("=" * 60)
    logger.info(f"✅ Импорт завершен!")
    logger.info(f"   Успешно импортировано: {total_imported}")
    logger.info(f"   Ошибок: {total_failed}")
    logger.info(f"   Всего обработано: {len(records)}")
    logger.info("=" * 60)
    
    return total_imported, total_failed

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Импорт данных прогресса из таблицы')
    parser.add_argument('--image', type=str, help='Путь к изображению таблицы для анализа через AI')
    parser.add_argument('--no-ai', action='store_true', help='Не использовать AI, только предустановленные данные')
    
    args = parser.parse_args()
    
    try:
        imported, failed = import_progress_data(
            image_path=args.image if not args.no_ai else None,
            use_ai=not args.no_ai
        )
        if failed == 0:
            print("\n✅ Все данные успешно импортированы!")
            sys.exit(0)
        else:
            print(f"\n⚠️ Импорт завершен с ошибками: {failed} записей не импортировано")
            sys.exit(1)
    except Exception as e:
        logger.error(f"Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
