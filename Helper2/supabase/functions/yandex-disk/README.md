# Edge Function для Яндекс Диска

Эта Edge Function позволяет работать с Яндекс Диском без backend сервера. Она проксирует запросы к Яндекс API и возвращает данные для frontend.

## Возможности

- ✅ Просмотр файлов и папок в любой директории
- ✅ Навигация по папкам
- ✅ Просмотр файлов (PDF, изображения, видео, документы)
- ✅ Скачивание файлов
- ✅ Работа без backend сервера

## Настройка

### Шаг 1: Настройка секретов в Supabase

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в **Settings** → **Edge Functions** → **Secrets**
4. Добавьте один из секретов:

   **Вариант А: Публичная папка (рекомендуется)**
   - Name: `YANDEX_DISK_PUBLIC_KEY`
   - Value: ваш публичный ключ Яндекс Диска
   
   **Вариант Б: OAuth токен**
   - Name: `YANDEX_DISK_TOKEN`
   - Value: ваш OAuth токен Яндекс Диска

### Шаг 2: Деплой Edge Function

```bash
# Убедитесь, что вы в папке Helper2
cd Helper2

# Войдите в Supabase CLI (если еще не вошли)
supabase login

# Свяжите проект (если еще не связан)
supabase link --project-ref yytqmdanfcwfqfqruvta

# Задеплойте функцию
supabase functions deploy yandex-disk
```

### Шаг 3: Проверка работы

После деплоя функция будет доступна по адресу:
```
https://yytqmdanfcwfqfqruvta.supabase.co/functions/v1/yandex-disk
```

Frontend автоматически использует эту функцию вместо backend сервера.

## API Endpoints

### GET `/functions/v1/yandex-disk?action=files&folder_path=...`
Получить список файлов из папки.

**Параметры:**
- `action=files` (обязательно)
- `folder_path` (опционально) - путь к папке

**Ответ:**
```json
{
  "files": [
    {
      "name": "file.pdf",
      "path": "/folder/file.pdf",
      "type": "file",
      "size": 1024,
      "mime_type": "application/pdf",
      "modified": "2025-01-01T00:00:00Z",
      "created": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "folder_path": "/",
  "is_public": true,
  "public_key": "..."
}
```

### GET `/functions/v1/yandex-disk?action=download-link&file_path=...`
Получить ссылку для скачивания файла.

**Параметры:**
- `action=download-link` (обязательно)
- `file_path` (обязательно) - путь к файлу

**Ответ:**
```json
{
  "download_url": "https://..."
}
```

### GET `/functions/v1/yandex-disk?action=view-link&file_path=...`
Получить ссылку для просмотра файла.

**Параметры:**
- `action=view-link` (обязательно)
- `file_path` (обязательно) - путь к файлу

**Ответ:**
```json
{
  "view_url": "https://..."
}
```

## Как получить публичный ключ Яндекс Диска

1. Откройте Яндекс Диск в браузере
2. Создайте публичную ссылку на папку (правый клик → "Получить ссылку")
3. Скопируйте ссылку вида: `https://disk.yandex.ru/d/XXXXXXXX`
4. Извлеките ключ `XXXXXXXX` из ссылки
5. Добавьте его в Supabase Secrets как `YANDEX_DISK_PUBLIC_KEY`

## Как получить OAuth токен Яндекс Диска

1. Зарегистрируйте приложение на [Yandex OAuth](https://oauth.yandex.ru/)
2. Получите токен через OAuth flow
3. Добавьте токен в Supabase Secrets как `YANDEX_DISK_TOKEN`

## Устранение неполадок

### Ошибка: "YANDEX_DISK_PUBLIC_KEY или YANDEX_DISK_TOKEN не настроены"
- Убедитесь, что секрет добавлен в Supabase Dashboard → Settings → Edge Functions → Secrets
- Проверьте правильность написания имени секрета (чувствительно к регистру)

### Ошибка: "Yandex API error 403"
- Проверьте правильность публичного ключа или токена
- Убедитесь, что папка действительно публичная (для публичного ключа)
- Проверьте, что токен не истек (для OAuth токена)

### Ошибка: "Превышено время ожидания"
- Яндекс API может быть медленным для больших папок
- Попробуйте обновить страницу или подождать немного

## Логи

Логи Edge Function можно посмотреть в Supabase Dashboard:
**Edge Functions** → **yandex-disk** → **Logs**
