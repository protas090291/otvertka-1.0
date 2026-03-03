# 🚀 Инструкция по деплою на TimeWeb Cloud

## ✅ Что готово

1. ✅ **Frontend** - React + Vite приложение готово к сборке
2. ✅ **Backend** - FastAPI сервер (`main_timeweb.py`) готов к деплою
3. ✅ **Переменные окружения** - настроены через `VITE_BACKEND_API_URL`
4. ✅ **CORS** - настроен с поддержкой переменной окружения `ALLOWED_ORIGINS`

---

## 📋 Пошаговая инструкция

### Шаг 1: Деплой Backend (Python приложение)

1. **В панели TimeWeb Cloud:**
   - Перейдите в **Сайты** → **Добавить сайт**
   - Выберите **"Python приложение"**
   - Подключите GitHub репозиторий: `https://github.com/protas090291/otvertka-1.0.git`
   - Укажите:
     - **Путь к приложению:** `Helper2/backend`
     - **Команда запуска:** `uvicorn main_timeweb:app --host 0.0.0.0 --port 8000`
     - **Python версия:** `3.10` или `3.11`

2. **Установите зависимости:**
   - В настройках Python приложения → **Зависимости**
   - Или через SSH:
   ```bash
   cd Helper2/backend
   pip install -r requirements_timeweb.txt
   ```

3. **Настройте переменные окружения:**
   ```env
   YANDEX_DISK_TOKEN=y0__xDplMyRCBiSuzsgrfjujhWQozV343SXWgSk3mhHwhrrnSQt5g
   PORT=8000
   ALLOWED_ORIGINS=https://ваш-домен.ru,https://www.ваш-домен.ru
   ```

4. **Привяжите домен для API:**
   - В настройках сайта → **Домены**
   - Добавьте поддомен (например, `api.ваш-домен.ru`)
   - Настройте DNS (A-запись или CNAME)

5. **Проверьте работу:**
   - Откройте: `https://api.ваш-домен.ru/`
   - Должен вернуться: `{"status": "ok", ...}`

---

### Шаг 2: Деплой Frontend (Статический сайт)

1. **В панели TimeWeb Cloud:**
   - Перейдите в **Сайты** → **Добавить сайт**
   - Выберите **"Статический сайт"**
   - Подключите GitHub репозиторий: `https://github.com/protas090291/otvertka-1.0.git`
   - Укажите:
     - **Путь к проекту:** `Helper2`
     - **Команда сборки:** `npm install && npm run build`
     - **Папка с результатом:** `dist`
     - **Node.js версия:** `18` или `20`

2. **Настройте переменные окружения:**
   ```env
   VITE_SUPABASE_URL=https://yytqmdanfcwfqfqruvta.supabase.co
   VITE_SUPABASE_ANON_KEY=ваш_anon_key
   VITE_SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_key
   VITE_BACKEND_API_URL=https://api.ваш-домен.ru
   ```

3. **Привяжите основной домен:**
   - В настройках сайта → **Домены**
   - Добавьте ваш домен (например, `ваш-домен.ru`)
   - Настройте DNS (A-запись на IP TimeWeb или CNAME)

---

### Шаг 3: Настройка DNS

Настройте DNS записи у вашего регистратора домена:

```
A запись:
@ → IP адрес TimeWeb (узнайте в панели)

Или CNAME:
@ → ваш-сайт.timeweb.ru

Для поддомена API:
api → IP адрес TimeWeb (или CNAME на поддомен TimeWeb)
```

---

### Шаг 4: Проверка работы

1. **Проверьте Backend:**
   ```bash
   curl https://api.ваш-домен.ru/
   # Должен вернуться: {"status": "ok", ...}
   ```

2. **Проверьте Frontend:**
   - Откройте: `https://ваш-домен.ru`
   - Должен загрузиться интерфейс приложения

3. **Проверьте интеграцию:**
   - Войдите в приложение
   - Перейдите в раздел "Яндекс Диск"
   - Файлы должны загружаться через API

---

## 🔧 Настройка переменных окружения

### Frontend (в панели TimeWeb):
- `VITE_SUPABASE_URL` - URL вашего Supabase проекта
- `VITE_SUPABASE_ANON_KEY` - Anon ключ Supabase
- `VITE_SUPABASE_SERVICE_ROLE_KEY` - Service Role ключ Supabase
- `VITE_BACKEND_API_URL` - URL вашего бэкенда (например, `https://api.ваш-домен.ru`)

### Backend (в панели TimeWeb):
- `YANDEX_DISK_TOKEN` - OAuth токен Яндекс Диска
- `PORT` - Порт приложения (обычно `8000`)
- `ALLOWED_ORIGINS` - Разрешенные домены для CORS (например, `https://ваш-домен.ru,https://www.ваш-домен.ru`)

---

## ⚠️ Важные замечания

1. **CORS:** После деплоя обновите `ALLOWED_ORIGINS` в бэкенде на конкретные домены вместо `*`

2. **HTTPS:** TimeWeb обычно предоставляет SSL-сертификат автоматически

3. **Переменные окружения:** Не храните секреты в коде, используйте настройки TimeWeb

4. **Автоматический деплой:** После каждого push в GitHub, TimeWeb автоматически пересоберет проект

---

## 📝 Структура на TimeWeb

```
Frontend (Статический сайт):
├── Домен: ваш-домен.ru
├── Репозиторий: otvertka-1.0
├── Путь: Helper2
├── Сборка: npm run build → dist/
└── Переменные: VITE_*

Backend (Python приложение):
├── Домен: api.ваш-домен.ru
├── Репозиторий: otvertka-1.0
├── Путь: Helper2/backend
├── Запуск: uvicorn main_timeweb:app
└── Переменные: YANDEX_DISK_TOKEN, PORT, ALLOWED_ORIGINS
```

---

## ✅ Готово!

После выполнения всех шагов ваше приложение будет доступно по адресу `https://ваш-домен.ru`
