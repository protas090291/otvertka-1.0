/**
 * API функции для работы с Яндекс Диском через бэкэнд на TimeWeb
 * Замените этот файл на yandexDiskApi.ts после деплоя бэкэнда
 */

export interface YandexDiskFile {
  name: string;
  path: string;
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
  public_key?: string;
}

export interface YandexDiskFilesResponse {
  files: YandexDiskFile[];
  total: number;
  folder_path: string;
  is_public?: boolean;
  public_key?: string;
}

// ⚠️ ВАЖНО: Замените на ваш домен TimeWeb после деплоя
const BACKEND_API_URL = 'https://ваш-домен-timeweb.ru/api/yandex-disk';

export const getYandexDiskFiles = async (folderPath?: string): Promise<YandexDiskFilesResponse> => {
  const url = `${BACKEND_API_URL}/files${folderPath ? `?folder_path=${encodeURIComponent(folderPath)}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Ошибка загрузки файлов' }));
    throw new Error(error.error || `Ошибка ${response.status}`);
  }

  return await response.json();
};

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
    throw new Error(error.error || `Ошибка ${response.status}`);
  }

  const data = await response.json();
  return data.download_url;
};

export const getYandexDiskViewLink = async (filePath: string): Promise<string> => {
  const url = `${BACKEND_API_URL}/view-link?file_path=${encodeURIComponent(filePath)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Ошибка получения ссылки' }));
    throw new Error(error.error || `Ошибка ${response.status}`);
  }

  const data = await response.json();
  return data.view_url;
};

// Для совместимости с существующим кодом
export const downloadFromYandexDisk = async (filePath: string): Promise<void> => {
  const downloadUrl = await getYandexDiskDownloadLink(filePath);
  window.open(downloadUrl, '_blank');
};

export const refreshYandexDiskFiles = async (folderPath?: string): Promise<YandexDiskFilesResponse> => {
  return getYandexDiskFiles(folderPath);
};
