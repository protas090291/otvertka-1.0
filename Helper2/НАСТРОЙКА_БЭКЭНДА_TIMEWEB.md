# Настройка бэкэнда на TimeWeb для Яндекс Диска

## Быстрый старт

### 1. Подготовка файлов

У вас уже есть все необходимые файлы:
- ✅ `backend/main_timeweb.py` - основной файл сервера
- ✅ `backend/yandex_disk_api.py` - функции для работы с Яндекс Диском
- ✅ `backend/requirements_timeweb.txt` - зависимости
- ✅ `backend/.env` - переменные окружения (создайте на TimeWeb)

### 2. Деплой на TimeWeb

#### Вариант А: Через Git (рекомендуется)

1. **Создайте репозиторий на GitHub/GitLab** (если еще нет)
2. **В панели TimeWeb:**
   - Перейдите в раздел "Сайты" → "Добавить сайт"
   - Выберите "Python приложение"
   - Укажите репозиторий Git
   - Укажите путь к приложению: `Helper2/backend`
   - Укажите команду запуска: `uvicorn main_timeweb:app --host 0.0.0.0 --port 8000`

#### Вариант Б: Через FTP

1. **Подключитесь к FTP TimeWeb**
2. **Загрузите файлы:**
   ```
   /public_html/
     ├── main_timeweb.py
     ├── yandex_disk_api.py
     ├── requirements_timeweb.txt
     └── .env (создайте вручную)
   ```

3. **В панели TimeWeb:**
   - Перейдите в раздел "Python"
   - Создайте новое приложение
   - Укажите файл запуска: `main_timeweb.py`
   - Установите зависимости: `pip install -r requirements_timeweb.txt`

### 3. Настройка переменных окружения

В панели TimeWeb найдите раздел "Переменные окружения" и добавьте:

```
YANDEX_DISK_PUBLIC_KEY=BSNe4agC5hSAoA
PORT=8000
```

**Или создайте файл `.env` в корне проекта:**
```env
YANDEX_DISK_PUBLIC_KEY=BSNe4agC5hSAoA
PORT=8000
```

### 4. Обновление фронтенда

После деплоя обновите `src/lib/yandexDiskApi.ts`:

```typescript
// Замените эту строку:
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/yandex-disk`;

// На эту (укажите ваш домен TimeWeb):
const BACKEND_API_URL = 'https://ваш-домен-timeweb.ru/api/yandex-disk';
```

И обновите функции:

```typescript
export const getYandexDiskFiles = async (folderPath?: string): Promise<YandexDiskFilesResponse> => {
  const url = `${BACKEND_API_URL}/files${folderPath ? `?folder_path=${encodeURIComponent(folderPath)}` : ''}`;
  // ... остальной код
};
```

### 5. Проверка работы

1. Откройте в браузере: `https://ваш-домен-timeweb.ru/`
2. Должно вернуться: `{"status": "ok", ...}`
3. Проверьте API: `https://ваш-домен-timeweb.ru/api/yandex-disk/files`
4. Должен вернуться список файлов

## Структура API

### GET `/api/yandex-disk/files?folder_path=...`
Получить список файлов из папки

**Параметры:**
- `folder_path` (опционально) - путь к папке

**Ответ:**
```json
{
  "files": [...],
  "total": 10,
  "folder_path": "/",
  "is_public": true,
  "public_key": "BSNe4agC5hSAoA"
}
```

### GET `/api/yandex-disk/download-link?file_path=...`
Получить ссылку для скачивания файла

**Параметры:**
- `file_path` (обязательно) - путь к файлу

**Ответ:**
```json
{
  "download_url": "https://..."
}
```

### GET `/api/yandex-disk/view-link?file_path=...`
Получить ссылку для просмотра файла

**Параметры:**
- `file_path` (обязательно) - путь к файлу

**Ответ:**
```json
{
  "view_url": "https://..."
}
```

## Решение проблем

### Ошибка: "Module not found"
- Убедитесь, что зависимости установлены: `pip install -r requirements_timeweb.txt`

### Ошибка: "YANDEX_DISK_PUBLIC_KEY не настроен"
- Проверьте переменные окружения в панели TimeWeb
- Или создайте файл `.env` с нужными переменными

### Ошибка: "CORS"
- Убедитесь, что в `main_timeweb.py` указаны правильные `allow_origins`
- В продакшене укажите конкретный домен фронтенда вместо `"*"`

### Порт не работает
- Проверьте, что порт указан правильно в настройках TimeWeb
- По умолчанию используется порт 8000

## Альтернатива: Использовать существующий бэкэнд

Если у вас уже есть бэкэнд на TimeWeb, просто добавьте эти эндпоинты в существующий `main.py` или `app.py`.
