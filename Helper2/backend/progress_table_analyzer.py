"""
Модуль для анализа изображений таблиц прогресса работ
Использует AI для распознавания структуры таблицы и извлечения данных
"""

import base64
import io
import json
import logging
from typing import List, Dict, Any, Optional
from PIL import Image
import requests
import os
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Загружаем переменные окружения
load_dotenv()

# Настройки OpenRouter API
OPENROUTER_API_KEY = os.getenv(
    "OPENROUTER_API_KEY",
    "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"
)
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


def analyze_progress_table(image_base64: str) -> List[Dict[str, Any]]:
    """
    Анализирует изображение таблицы прогресса и извлекает данные
    
    Args:
        image_base64: Base64 строка изображения
    
    Returns:
        Список словарей с данными о работах и прогрессе по квартирам
    """
    try:
        # 1. Декодируем изображение
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))
        
        # 2. Конвертируем в base64 для отправки в AI
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode()
        
        # 3. Формируем детальный промпт для AI
        prompt = """
Проанализируй эту фотографию таблицы прогресса строительных работ.

Структура таблицы:
- Строки: категории работ (например, "Отделочные работы", "Работы по Механическим системам") и конкретные задачи под каждой категорией
- Колонки: "ВСЕГО", "Факт", затем этажи (Этаж №1, №2, №3... №14) с подколонками для секций (T101, T201, T202-И, T301, Y501 и т.д.)
- Ячейки: содержат проценты выполнения (0-100%) с цветовой индикацией

ЗАДАЧА: Извлеки все данные из таблицы и верни в формате JSON массива.

Для каждой ячейки с процентом (не пустой и не 0%, если явно указан 0% - включи):
{
  "taskName": "Полное название работы из строки (например: 'Устройство металлического каркаса перегородок и стен')",
  "section": "Категория работы из первой колонки (например: 'Отделочные работы', 'Работы по ОТ+ВК')",
  "apartmentId": "Номер секции/квартиры из заголовка колонки (например: 'T101', 'T201', 'T202-И', 'Y501')",
  "factProgress": число от 0 до 100 (процент из ячейки),
  "planProgress": 100 (по умолчанию, или значение из колонки 'ВСЕГО' если доступно)
}

ВАЖНО:
1. Извлекай ВСЕ ячейки с процентами (не только зеленые)
2. Если процент не указан явно, но ячейка не пустая - попробуй определить визуально или пропусти
3. Номер квартиры берется из заголовка колонки (T101, T201, Y501 и т.д.)
4. Название работы - полный текст из строки таблицы
5. Категория (section) - это название группы работ (Отделочные работы, Механические системы и т.д.)
6. Если в строке есть подзадачи, используй полное название подзадачи

Верни ТОЛЬКО валидный JSON массив, без дополнительного текста.
"""

        # 4. Отправляем запрос в OpenRouter с поддержкой изображений
        logger.info("Отправка запроса в AI для анализа таблицы прогресса...")
        
        response = requests.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://construction-management.local",
                "X-Title": "Construction Progress Table Analyzer"
            },
            json={
                "model": "openrouter/google/gemini-pro-vision:free",  # Модель с поддержкой изображений
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{img_base64}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 4000,
                "temperature": 0.1  # Низкая температура для более точного извлечения данных
            },
            timeout=120  # Увеличенный таймаут для больших таблиц
        )
        
        if response.status_code != 200:
            logger.error(f"Ошибка AI API: {response.status_code} - {response.text}")
            raise Exception(f"AI API вернул ошибку: {response.status_code} - {response.text}")
        
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        
        logger.info(f"Получен ответ от AI, длина: {len(content)} символов")
        
        # 5. Парсим JSON из ответа AI
        # Убираем markdown код блоки, если есть
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            # Пробуем найти JSON между любыми ``` блоками
            parts = content.split("```")
            for i in range(1, len(parts), 2):  # Берем нечетные части (между ```)
                try:
                    json.loads(parts[i].strip())
                    content = parts[i].strip()
                    break
                except:
                    continue
        
        # Пробуем найти JSON массив в тексте
        start_idx = content.find('[')
        end_idx = content.rfind(']')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            content = content[start_idx:end_idx + 1]
        
        results = json.loads(content)
        
        # 6. Валидация и нормализация результатов
        validated_results = []
        for item in results:
            if isinstance(item, dict):
                task_name = str(item.get("taskName", "")).strip()
                section = str(item.get("section", "")).strip()
                apartment_id = str(item.get("apartmentId", "")).strip()
                fact_progress = item.get("factProgress", 0)
                plan_progress = item.get("planProgress", 100)
                
                # Пропускаем пустые записи
                if not task_name or not apartment_id:
                    continue
                
                # Нормализуем прогресс
                try:
                    fact_progress = max(0, min(100, int(float(fact_progress))))
                    plan_progress = max(0, min(100, int(float(plan_progress))))
                except (ValueError, TypeError):
                    continue
                
                validated_results.append({
                    "taskName": task_name,
                    "section": section or "Общие работы",
                    "apartmentId": apartment_id,
                    "factProgress": fact_progress,
                    "planProgress": plan_progress,
                    "confidence": float(item.get("confidence", 0.8))
                })
        
        logger.info(f"✅ Извлечено {len(validated_results)} записей из таблицы прогресса")
        return validated_results
        
    except json.JSONDecodeError as e:
        logger.error(f"Ошибка парсинга JSON: {e}")
        logger.error(f"Содержимое ответа: {content[:500]}")
        raise Exception(f"Не удалось распарсить ответ AI как JSON: {e}")
    except Exception as e:
        logger.error(f"Ошибка анализа таблицы: {e}")
        raise
