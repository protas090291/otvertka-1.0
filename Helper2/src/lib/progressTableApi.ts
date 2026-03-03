// API для анализа таблиц прогресса и импорта данных
import { upsertProgressData } from './progressApi';

export interface ProgressTableResult {
  taskName: string;
  section: string;
  apartmentId: string;
  factProgress: number;
  planProgress: number;
  confidence: number;
}

export interface ProgressTableAnalysisResponse {
  success: boolean;
  results: ProgressTableResult[];
  count: number;
  message: string;
}

export interface BatchImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

const BACKEND_URL = 'http://localhost:8000';

/**
 * Анализ изображения таблицы прогресса
 */
export const analyzeProgressTable = async (
  imageFile: File
): Promise<ProgressTableResult[]> => {
  try {
    // Конвертируем файл в base64
    const base64 = await fileToBase64(imageFile);
    
    // Отправляем на backend для анализа
    const response = await fetch(`${BACKEND_URL}/api/progress/analyze-table`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка анализа таблицы: ${response.status} - ${errorText}`);
    }

    const data: ProgressTableAnalysisResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Ошибка анализа таблицы');
    }

    return data.results || [];
  } catch (error) {
    console.error('Ошибка анализа таблицы прогресса:', error);
    throw error;
  }
};

/**
 * Анализ таблицы через загрузку файла
 */
export const analyzeProgressTableFile = async (
  imageFile: File
): Promise<ProgressTableResult[]> => {
  try {
    const formData = new FormData();
    formData.append('file', imageFile);
    
    const response = await fetch(`${BACKEND_URL}/api/progress/analyze-table-file`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка анализа таблицы: ${response.status} - ${errorText}`);
    }

    const data: ProgressTableAnalysisResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Ошибка анализа таблицы');
    }

    return data.results || [];
  } catch (error) {
    console.error('Ошибка анализа таблицы прогресса:', error);
    throw error;
  }
};

/**
 * Массовый импорт данных прогресса в базу
 */
export const batchImportProgressData = async (
  results: ProgressTableResult[],
  onProgress?: (imported: number, total: number) => void
): Promise<BatchImportResult> => {
  const errors: string[] = [];
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    
    try {
      await upsertProgressData(
        result.taskName,
        result.section,
        result.apartmentId,
        result.factProgress,
        result.planProgress,
        'Система (импорт из таблицы)',
        `Автоматически импортировано из таблицы прогресса`,
        `Уверенность распознавания: ${(result.confidence * 100).toFixed(1)}%`
      );
      
      imported++;
      onProgress?.(imported, results.length);
    } catch (error) {
      const errorMsg = `Ошибка импорта "${result.taskName}" для ${result.apartmentId}: ${error}`;
      errors.push(errorMsg);
      failed++;
      console.error(errorMsg);
    }
  }

  return {
    success: failed === 0,
    imported,
    failed,
    errors,
  };
};

/**
 * Конвертация файла в base64
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
