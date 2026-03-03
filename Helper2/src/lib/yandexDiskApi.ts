/**
 * API функции для работы с Яндекс Диском через бэкэнд
 * Только чтение и скачивание файлов
 * Использует переменную окружения VITE_BACKEND_API_URL для продакшена
 * По умолчанию использует localhost:8000 для разработки
 */

// Используем переменную окружения для продакшена или localhost для разработки
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL 
  ? `${import.meta.env.VITE_BACKEND_API_URL}/api/yandex-disk`
  : 'http://localhost:8000/api/yandex-disk';

export interface YandexDiskFile {
  name: string;
  path: string;  // Полный путь для отображения
  relativePath?: string;  // Относительный путь от корня публичной папки (для API запросов)
  type: 'file' | 'dir';
  size: number;
  size_formatted: string;
  modified: string;
  modified_formatted: string;
  created: string;
  created_formatted: string;
  mime_type: string;
  preview?: string;
  public_url?: string;
  public_key?: string;  // Публичный ключ для скачивания из публичной папки
}

export interface YandexDiskFilesResponse {
  files: YandexDiskFile[];
  total: number;
  folder_path: string;
  is_public?: boolean;  // Флаг публичной папки
  public_key?: string;  // Публичный ключ папки
}

// Вспомогательные функции форматирования
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString('ru-RU');
  } catch {
    return dateString;
  }
}

/**
 * Получить список файлов из папки на Яндекс Диске через бэкэнд
 * С автоматическими повторными попытками при временных ошибках
 */
export const getYandexDiskFiles = async (folderPath?: string, retries: number = 2): Promise<YandexDiskFilesResponse> => {
  const url = `${BACKEND_API_URL}/files${folderPath ? `?folder_path=${encodeURIComponent(folderPath)}` : ''}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 секунд
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Ошибка получения файлов' }));
          throw new Error(error.error || error.detail || `Ошибка ${response.status}`);
        }
        
        const data = await response.json();
        
        // Форматируем данные для совместимости с существующим интерфейсом
        return {
          files: (data.files || []).map((file: any) => ({
            ...file,
            size_formatted: formatFileSize(file.size || 0),
            modified_formatted: formatDate(file.modified),
            created_formatted: formatDate(file.created),
          })),
          total: data.total || 0,
          folder_path: data.folder_path || folderPath || '/',
          is_public: data.is_public || false,
          public_key: data.public_key,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          }
          throw new Error('Превышено время ожидания ответа от сервера. Попробуйте обновить страницу или проверить подключение к интернету.');
        }
        
        // Повторная попытка при сетевых ошибках
        if (attempt < retries && (
          fetchError.message?.includes('network') ||
          fetchError.message?.includes('Failed to fetch') ||
          fetchError.message?.includes('ECONNREFUSED')
        )) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
          continue;
        }
        
        throw fetchError;
      }
    } catch (error) {
      if (attempt === retries) {
        console.error('Ошибка получения файлов из Яндекс Диска:', error);
        throw error;
      }
    }
  }
  
  throw new Error('Не удалось загрузить файлы после нескольких попыток');
};

/**
 * Получить прямую ссылку для скачивания файла через бэкэнд
 */
export const getYandexDiskDownloadLink = async (filePath: string): Promise<string> => {
  const url = `${BACKEND_API_URL}/download-link?file_path=${encodeURIComponent(filePath)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Ошибка получения ссылки' }));
    throw new Error(error.error || error.detail || `Ошибка ${response.status}`);
  }
  
  const data = await response.json();
  return data.download_url;
};

/**
 * Скачать файл с Яндекс Диска через бэкэнд
 */
export const downloadFromYandexDisk = async (filePath: string, fileName?: string): Promise<void> => {
  try {
    // Получаем ссылку для скачивания через бэкэнд
    const downloadUrl = await getYandexDiskDownloadLink(filePath);
    
    // Используем прямую ссылку для скачивания
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName || filePath.split('/').pop() || 'file';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Ошибка скачивания файла из Яндекс Диска:', error);
    throw error;
  }
};

/**
 * Обновить список файлов (алиас для getYandexDiskFiles)
 */
export const refreshYandexDiskFiles = async (folderPath?: string): Promise<YandexDiskFilesResponse> => {
  return getYandexDiskFiles(folderPath);
};

/**
 * Получить ссылку для просмотра файла через бэкэнд (открытие в браузере вместо скачивания)
 */
export const getYandexDiskViewLink = async (filePath: string): Promise<string> => {
  const url = `${BACKEND_API_URL}/view-link?file_path=${encodeURIComponent(filePath)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Ошибка получения ссылки для просмотра' }));
    throw new Error(error.error || error.detail || `Ошибка ${response.status}`);
  }
  
  const data = await response.json();
  return data.view_url;
};
