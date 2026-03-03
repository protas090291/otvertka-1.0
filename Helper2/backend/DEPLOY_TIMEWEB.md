# Деплой бэкэнда на TimeWeb для Яндекс Диска

## Вариант 1: Деплой Python FastAPI на TimeWeb (РЕКОМЕНДУЕТСЯ)

### Преимущества:
- ✅ Полный контроль над API
- ✅ Работает надежно без проблем с CORS
- ✅ Можно использовать существующий код из `simple_main.py`
- ✅ TimeWeb поддерживает Python приложения

### Шаги деплоя:

1. **Подготовка проекта:**
   ```bash
   cd Helper2/backend
   ```

2. **Создать файл `requirements.txt`:**
   ```
   fastapi==0.104.1
   uvicorn==0.24.0
   python-dotenv==1.0.0
   requests==2.31.0
   ```

3. **Создать файл `main.py`** (упрощенная версия для TimeWeb):
   ```python
   from fastapi import FastAPI
   from fastapi.middleware.cors import CORSMiddleware
   from yandex_disk_api import get_folder_contents, get_public_download_link, get_public_view_link
   import os
   from dotenv import load_dotenv

   load_dotenv()

   app = FastAPI()

   # CORS для работы с фронтендом
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],  # В продакшене указать конкретный домен
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )

   @app.get("/api/yandex-disk/files")
   async def get_files(folder_path: str = None):
       files = get_folder_contents(folder_path)
       return {"files": files, "total": len(files)}

   @app.get("/api/yandex-disk/download-link")
   async def get_download_link(file_path: str):
       public_key = os.getenv("YANDEX_DISK_PUBLIC_KEY")
       link = get_public_download_link(public_key, file_path)
       return {"download_url": link}

   @app.get("/")
   async def root():
       return {"status": "ok"}
   ```

4. **Настроить на TimeWeb:**
   - Загрузить код через Git или FTP
   - Установить зависимости: `pip install -r requirements.txt`
   - Настроить переменные окружения в панели TimeWeb
   - Запустить: `uvicorn main:app --host 0.0.0.0 --port 8000`

## Вариант 2: Деплой Node.js Express на TimeWeb

### Преимущества:
- ✅ Проще для фронтенда (один язык)
- ✅ TimeWeb хорошо поддерживает Node.js

### Создать `server.js`:
```javascript
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const YANDEX_DISK_API_BASE = "https://cloud-api.yandex.net/v1/disk";
const PUBLIC_KEY = process.env.YANDEX_DISK_PUBLIC_KEY;

app.get('/api/yandex-disk/files', async (req, res) => {
  try {
    const folderPath = req.query.folder_path;
    const publicUrl = `https://disk.yandex.ru/d/${PUBLIC_KEY}`;
    
    const params = {
      public_key: publicUrl,
      limit: 10000
    };
    
    if (folderPath) {
      params.path = folderPath;
    }
    
    const response = await axios.get(`${YANDEX_DISK_API_BASE}/public/resources`, { params });
    const items = response.data._embedded?.items || [];
    
    res.json({
      files: items.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size || 0,
        mime_type: item.mime_type || '',
        modified: item.modified,
        created: item.created,
        preview: item.preview || '',
        public_url: item.public_url || ''
      })),
      total: items.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/yandex-disk/download-link', async (req, res) => {
  try {
    const filePath = req.query.file_path;
    const publicUrl = `https://disk.yandex.ru/d/${PUBLIC_KEY}`;
    
    const response = await axios.get(`${YANDEX_DISK_API_BASE}/public/resources/download`, {
      params: {
        public_key: publicUrl,
        path: filePath
      }
    });
    
    res.json({ download_url: response.data.href });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Вариант 3: Использовать существующий бэкэнд и просто изменить URL

Если у вас уже есть бэкэнд на TimeWeb, просто измените URL в `yandexDiskApi.ts`:

```typescript
const BACKEND_API_URL = 'https://ваш-домен-timeweb.ru/api/yandex-disk';
```

## Настройка переменных окружения на TimeWeb

В панели TimeWeb добавьте:
- `YANDEX_DISK_PUBLIC_KEY=BSNe4agC5hSAoA`
- `PORT=8000` (если нужно)

## Обновление фронтенда

После деплоя обновите `yandexDiskApi.ts`:

```typescript
const BACKEND_API_URL = 'https://ваш-домен-timeweb.ru/api/yandex-disk';
```
