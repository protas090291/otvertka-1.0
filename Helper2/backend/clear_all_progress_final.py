#!/usr/bin/env python3
"""
Полная очистка таблицы progress_data
"""
import os
import sys
from dotenv import load_dotenv
from pathlib import Path
import requests
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL") or 'https://yytqmdanfcwfqfqruvta.supabase.co'
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dHFtZGFuZmN3ZnFmcXJ1dnRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzUzMzM0MSwiZXhwIjoyMDczMTA5MzQxfQ.ni200CDPDR225aDJhBHQXh17t0fnX8bXuzYflOTPYnM'

def clear_all_data():
    """Удаляет все записи из таблицы progress_data"""
    url = f"{SUPABASE_URL}/rest/v1/progress_data"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # Удаляем все записи через DELETE без условий (удаляет все)
        # Используем специальный заголовок Prefer для подтверждения
        response = requests.delete(
            url,
            headers=headers,
            params={"id": "neq.00000000-0000-0000-0000-000000000000"},  # Условие, которое вернет все записи
            timeout=120
        )
        
        if response.status_code in [200, 204]:
            logger.info("✅ Все записи успешно удалены")
            return True
        else:
            # Если не получилось, пробуем удалить через цикл
            logger.warning(f"⚠️ Прямое удаление не сработало (HTTP {response.status_code}), используем постраничное удаление...")
            
            # Получаем все ID и удаляем по одному
            all_ids = []
            offset = 0
            limit = 1000
            
            while True:
                get_response = requests.get(
                    url,
                    headers=headers,
                    params={"select": "id", "limit": limit, "offset": offset}
                )
                
                if get_response.status_code in [200, 206]:
                    data = get_response.json()
                    if not data or len(data) == 0:
                        break
                    all_ids.extend([r["id"] for r in data])
                    offset += limit
                    if len(data) < limit:
                        break
                else:
                    break
            
            logger.info(f"   Найдено записей для удаления: {len(all_ids)}")
            
            # Удаляем по одной
            deleted = 0
            for record_id in all_ids:
                delete_response = requests.delete(
                    url,
                    headers=headers,
                    params={"id": f"eq.{record_id}"},
                    timeout=30
                )
                if delete_response.status_code in [200, 204]:
                    deleted += 1
                if deleted % 100 == 0:
                    logger.info(f"   Удалено: {deleted}/{len(all_ids)}")
            
            logger.info(f"✅ Удалено записей: {deleted}")
            return deleted == len(all_ids)
            
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")
        return False

if __name__ == "__main__":
    logger.info("🗑️  Начало очистки таблицы progress_data...")
    if clear_all_data():
        logger.info("✅ Очистка завершена успешно")
        sys.exit(0)
    else:
        logger.error("❌ Очистка завершилась с ошибками")
        sys.exit(1)
