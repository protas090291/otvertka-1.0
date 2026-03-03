/**
 * Прямой доступ к Яндекс Диску через публичные ссылки
 * БЕЗ использования Edge Function или бэкэнда
 * 
 * Этот подход использует прямые ссылки на файлы и папки Яндекс Диска
 */

export interface YandexDiskDirectFile {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  public_url?: string;  // Прямая публичная ссылка на файл/папку
  view_url?: string;    // Ссылка для просмотра в браузере
  download_url?: string; // Ссылка для скачивания
}

/**
 * Формирует прямую ссылку для просмотра файла/папки в Яндекс Диске
 * @param publicKey - Публичный ключ папки (например, "BSNe4agC5hSAoA")
 * @param path - Путь к файлу/папке относительно корня публичной папки
 * @returns Прямая ссылка для просмотра
 */
export function getYandexDiskDirectViewUrl(publicKey: string, path?: string): string {
  const baseUrl = `https://disk.yandex.ru/d/${publicKey}`;
  if (path) {
    // Кодируем путь для URL
    const encodedPath = encodeURIComponent(path);
    return `${baseUrl}?path=${encodedPath}`;
  }
  return baseUrl;
}

/**
 * Формирует прямую ссылку для скачивания файла
 * @param publicKey - Публичный ключ папки
 * @param path - Путь к файлу относительно корня публичной папки
 * @returns Прямая ссылка для скачивания
 */
export function getYandexDiskDirectDownloadUrl(publicKey: string, path: string): string {
  // Для публичных папок Яндекс Диска ссылка для скачивания формируется так:
  // https://disk.yandex.ru/d/{publicKey}?path={encodedPath}
  // И затем нужно получить прямую ссылку через API, но это требует прокси...
  
  // Альтернатива: использовать прямую ссылку на файл через публичный URL
  // Но для этого нужен public_url файла, который получается через API
  
  // Пока возвращаем ссылку для просмотра, откуда можно скачать
  return getYandexDiskDirectViewUrl(publicKey, path);
}

/**
 * Открывает файл/папку в Яндекс Диске в новой вкладке
 * @param publicKey - Публичный ключ папки
 * @param path - Путь к файлу/папке (опционально)
 */
export function openYandexDiskInBrowser(publicKey: string, path?: string): void {
  const url = getYandexDiskDirectViewUrl(publicKey, path);
  window.open(url, '_blank');
}

/**
 * Встраивает Яндекс Диск через iframe
 * Это позволяет просматривать содержимое папки прямо на странице
 * @param publicKey - Публичный ключ папки
 * @param path - Путь к папке (опционально)
 * @returns URL для iframe
 */
export function getYandexDiskEmbedUrl(publicKey: string, path?: string): string {
  // Яндекс Диск не предоставляет официальный embed API
  // Но можно использовать прямую ссылку в iframe (может не работать из-за X-Frame-Options)
  return getYandexDiskDirectViewUrl(publicKey, path);
}
