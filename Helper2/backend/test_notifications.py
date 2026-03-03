#!/usr/bin/env python3
"""
Тестовый скрипт для проверки уведомлений в базе данных
"""
import os
import sys
from dotenv import load_dotenv
from pathlib import Path
import requests
import json

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL") or 'https://yytqmdanfcwfqfqruvta.supabase.co'
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dHFtZGFuZmN3ZnFmcXJ1dnRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzUzMzM0MSwiZXhwIjoyMDczMTA5MzQxfQ.ni200CDPDR225aDJhBHQXh17t0fnX8bXuzYflOTPYnM'

def get_all_notifications():
    """Получить все уведомления из базы"""
    url = f"{SUPABASE_URL}/rest/v1/notifications"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers, params={"select": "*", "order": "created_at.desc", "limit": "100"})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Ошибка получения уведомлений: {e}")
        return None

def get_user_profiles():
    """Получить все профили пользователей"""
    url = f"{SUPABASE_URL}/rest/v1/user_profiles"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers, params={"select": "id,email,full_name", "limit": "100"})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Ошибка получения профилей: {e}")
        return None

def main():
    print("🔍 Проверка уведомлений в базе данных...\n")
    
    # Получаем профили пользователей
    print("📋 Загрузка профилей пользователей...")
    profiles = get_user_profiles()
    if profiles:
        print(f"✅ Найдено профилей: {len(profiles)}")
        print("\nПользователи:")
        for profile in profiles[:10]:  # Показываем первые 10
            print(f"  - {profile.get('email', 'N/A')} (ID: {profile.get('id', 'N/A')[:8]}...)")
        print()
    
    # Получаем уведомления
    print("📬 Загрузка уведомлений...")
    notifications = get_all_notifications()
    
    if notifications is None:
        print("❌ Не удалось загрузить уведомления")
        return
    
    print(f"✅ Найдено уведомлений: {len(notifications)}\n")
    
    if len(notifications) == 0:
        print("ℹ️ Уведомлений в базе данных нет")
        print("\n💡 Попробуйте создать задачу или отчёт в приложении")
        return
    
    # Группируем по получателям
    by_recipient = {}
    for notif in notifications:
        recipient_id = notif.get('recipient_id', 'unknown')
        if recipient_id not in by_recipient:
            by_recipient[recipient_id] = []
        by_recipient[recipient_id].append(notif)
    
    print("📊 Уведомления по получателям:")
    for recipient_id, notifs in by_recipient.items():
        # Находим email пользователя
        user_email = "Неизвестный"
        if profiles:
            user = next((p for p in profiles if p.get('id') == recipient_id), None)
            if user:
                user_email = user.get('email', 'N/A')
        
        print(f"\n  👤 {user_email} (ID: {recipient_id[:8]}...)")
        print(f"     Всего уведомлений: {len(notifs)}")
        
        unread = [n for n in notifs if not n.get('read', False)]
        print(f"     Непрочитанных: {len(unread)}")
        
        if unread:
            print("     Последние непрочитанные:")
            for n in unread[:3]:
                print(f"       - [{n.get('type', 'N/A')}] {n.get('title', 'N/A')}")
                print(f"         Создано: {n.get('created_at', 'N/A')}")
                print(f"         Persistent: {n.get('persistent', False)}")
    
    print("\n" + "="*60)
    print("💡 Если уведомления есть в БД, но не отображаются в приложении:")
    print("   1. Проверьте консоль браузера (F12)")
    print("   2. Убедитесь, что recipient_id совпадает с ID пользователя")
    print("   3. Проверьте RLS политики в Supabase Dashboard")

if __name__ == "__main__":
    main()
