import { supabase } from './supabase';
import { ProgressData, ProgressDataInput, ProgressDataUpdate } from '../types';
import { createWorkJournalEntry } from './workJournalApi';
import { normalizeApartmentId } from './dataNormalizer';
import { validateRequired, validateProgress, validateApartmentId, validateString } from './dataValidator';

// API функции для работы с данными прогресса

/**
 * Получить все данные прогресса
 */
export const getAllProgressData = async (): Promise<ProgressData[]> => {
  try {
    // Загружаем все данные с пагинацией (Supabase по умолчанию лимит 1000)
    let allData: ProgressData[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('progress_data')
        .select('*')
        .order('task_name', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Ошибка получения данных прогресса:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += pageSize;
        hasMore = data.length === pageSize; // Если получили полную страницу, возможно есть еще
      } else {
        hasMore = false;
      }
    }

    console.log(`📊 getAllProgressData: загружено ${allData.length} записей`);
    return allData;
  } catch (error) {
    console.error('Ошибка в getAllProgressData:', error);
    return [];
  }
};

/**
 * Получить данные прогресса по задаче и секции
 */
export const getProgressDataByTaskAndSection = async (
  taskName: string, 
  section: string
): Promise<ProgressData[]> => {
  try {
    const { data, error } = await supabase
      .from('progress_data')
      .select('*')
      .eq('task_name', taskName)
      .eq('section', section)
      .order('apartment_id', { ascending: true });

    if (error) {
      console.error('Ошибка получения данных прогресса по задаче и секции:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getProgressDataByTaskAndSection:', error);
    return [];
  }
};

/**
 * Получить данные прогресса по квартире
 */
export const getProgressDataByApartment = async (apartmentId: string): Promise<ProgressData[]> => {
  try {
    const { data, error } = await supabase
      .from('progress_data')
      .select('*')
      .eq('apartment_id', apartmentId)
      .order('task_name', { ascending: true });

    if (error) {
      console.error('Ошибка получения данных прогресса по квартире:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getProgressDataByApartment:', error);
    return [];
  }
};

/**
 * Создать или обновить данные прогресса
 */
export const upsertProgressData = async (
  taskName: string,
  section: string,
  apartmentId: string,
  factProgress: number,
  planProgress: number,
  updatedBy?: string,
  workDescription?: string,
  notes?: string
): Promise<ProgressData | null> => {
  try {
    // 1. ВАЛИДАЦИЯ - проверяем данные
    validateRequired(taskName, 'Название задачи');
    validateRequired(section, 'Секция');
    validateRequired(apartmentId, 'ID квартиры');
    validateApartmentId(apartmentId);
    validateProgress(factProgress, 'Фактический прогресс');
    validateProgress(planProgress, 'Плановый прогресс');
    validateString(taskName, 'Название задачи', 1, 200);
    validateString(section, 'Секция', 1, 100);
    
    // 2. НОРМАЛИЗАЦИЯ - преобразуем ID квартиры в единый формат
    const normalizedApartmentId = normalizeApartmentId(apartmentId);
    const normalizedTaskName = taskName.trim();
    const normalizedSection = section.trim();
    
    // Получаем текущие данные для сравнения (используем нормализованный ID)
    const { data: existingData } = await supabase
      .from('progress_data')
      .select('fact_progress, plan_progress')
      .eq('task_name', normalizedTaskName)
      .eq('section', normalizedSection)
      .eq('apartment_id', normalizedApartmentId)
      .single();

    const previousFactProgress = existingData?.fact_progress || 0;
    const previousPlanProgress = existingData?.plan_progress || 0;

    // Сохраняем данные прогресса
    // Явно обновляем updated_at, чтобы изменения отображались в последних обновлениях
    const now = new Date().toISOString();
    
    // Проверяем, существует ли запись (используем нормализованные данные)
    const { data: existingRecord } = await supabase
      .from('progress_data')
      .select('id')
      .eq('task_name', normalizedTaskName)
      .eq('section', normalizedSection)
      .eq('apartment_id', normalizedApartmentId)
      .single();

    let data, error;
    
    if (existingRecord) {
      // Если запись существует, используем UPDATE для гарантированного обновления updated_at
      const updateResult = await supabase
        .from('progress_data')
        .update({
          fact_progress: factProgress,
          plan_progress: planProgress,
          updated_by: updatedBy,
          updated_at: now
        })
        .eq('task_name', normalizedTaskName)
        .eq('section', normalizedSection)
        .eq('apartment_id', normalizedApartmentId)
        .select()
        .single();
      data = updateResult.data;
      error = updateResult.error;
    } else {
      // Если записи нет, создаем новую (используем нормализованные данные)
      const insertResult = await supabase
        .from('progress_data')
        .insert({
          task_name: normalizedTaskName,
          section: normalizedSection,
          apartment_id: normalizedApartmentId,
          fact_progress: factProgress,
          plan_progress: planProgress,
          updated_by: updatedBy,
          updated_at: now,
          created_at: now
        })
        .select()
        .single();
      data = insertResult.data;
      error = insertResult.error;
    }

    if (error) {
      console.error('Ошибка создания/обновления данных прогресса:', error);
      throw error;
    }

    // Логируем для отладки
    if (data) {
      console.log('✅ Прогресс обновлен:', {
        task: taskName,
        section: section,
        apartment: apartmentId,
        fact_progress: factProgress,
        updated_at: data.updated_at,
        timestamp: new Date(data.updated_at).toISOString()
      });
    }

    // Создаем запись в журнале работ, если прогресс изменился
    if (previousFactProgress !== factProgress || previousPlanProgress !== planProgress) {
      const progressDelta = factProgress - previousFactProgress;
      
      if (progressDelta !== 0) {
        const journalDescription = workDescription || 
          `Обновлен прогресс по задаче "${taskName}" в квартире ${apartmentId}`;
        
        await createWorkJournalEntry({
          task_name: taskName,
          section: section,
          apartment_id: apartmentId,
          work_description: journalDescription,
          progress_before: previousFactProgress,
          progress_after: factProgress,
          work_date: new Date().toISOString().split('T')[0],
          work_time: new Date().toTimeString().split(' ')[0].substring(0, 8),
          worker_name: updatedBy || 'Система',
          worker_role: updatedBy || 'system',
          notes: notes || `Изменение прогресса: ${previousFactProgress}% → ${factProgress}% (${progressDelta > 0 ? '+' : ''}${progressDelta}%)`
        });
      }
    }

    return data;
  } catch (error) {
    console.error('Ошибка в upsertProgressData:', error);
    return null;
  }
};

/**
 * Обновить данные прогресса
 */
export const updateProgressData = async (
  id: string,
  updates: ProgressDataUpdate
): Promise<ProgressData | null> => {
  try {
    const { data, error } = await supabase
      .from('progress_data')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Ошибка обновления данных прогресса:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Ошибка в updateProgressData:', error);
    return null;
  }
};

/**
 * Удалить данные прогресса
 */
export const deleteProgressData = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('progress_data')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Ошибка удаления данных прогресса:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Ошибка в deleteProgressData:', error);
    return false;
  }
};

/**
 * Получить статистику прогресса
 */
export const getProgressStats = async (): Promise<{
  totalTasks: number;
  totalApartments: number;
  averageProgress: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
}> => {
  try {
    const { data, error } = await supabase
      .from('progress_data')
      .select('task_name, section, apartment_id, fact_progress');

    if (error) {
      console.error('Ошибка получения статистики прогресса:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        totalTasks: 0,
        totalApartments: 0,
        averageProgress: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        notStartedTasks: 0
      };
    }

    // Группируем по задачам
    const taskGroups: { [key: string]: number[] } = {};
    const apartments = new Set<string>();

    data.forEach(item => {
      const key = `${item.task_name}|${item.section}`;
      if (!taskGroups[key]) {
        taskGroups[key] = [];
      }
      taskGroups[key].push(item.fact_progress);
      apartments.add(item.apartment_id);
    });

    // Вычисляем средний прогресс для каждой задачи
    const taskAverages = Object.values(taskGroups).map(progresses => 
      progresses.reduce((sum, progress) => sum + progress, 0) / progresses.length
    );

    const totalTasks = Object.keys(taskGroups).length;
    const totalApartments = apartments.size;
    const averageProgress = taskAverages.reduce((sum, avg) => sum + avg, 0) / taskAverages.length;
    const completedTasks = taskAverages.filter(avg => avg === 100).length;
    const inProgressTasks = taskAverages.filter(avg => avg > 0 && avg < 100).length;
    const notStartedTasks = taskAverages.filter(avg => avg === 0).length;

    return {
      totalTasks,
      totalApartments,
      averageProgress: Math.round(averageProgress),
      completedTasks,
      inProgressTasks,
      notStartedTasks
    };
  } catch (error) {
    console.error('Ошибка в getProgressStats:', error);
    return {
      totalTasks: 0,
      totalApartments: 0,
      averageProgress: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      notStartedTasks: 0
    };
  }
};

/**
 * Экспорт данных прогресса в CSV
 */
export const exportProgressDataToCSV = async (): Promise<string> => {
  try {
    const data = await getAllProgressData();
    
    const csvHeaders = ['Задача', 'Секция', 'Квартира', 'Факт %', 'План %', 'Обновлено', 'Обновил'];
    const csvRows = data.map(item => [
      item.task_name,
      item.section,
      item.apartment_id,
      item.fact_progress,
      item.plan_progress,
      new Date(item.updated_at).toLocaleDateString('ru'),
      item.updated_by || 'Неизвестно'
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  } catch (error) {
    console.error('Ошибка экспорта данных прогресса:', error);
    return '';
  }
};

/**
 * Массово создать (или убедиться, что существуют) записи по новой работе
 * для всех переданных квартир с нулевыми значениями.
 */
export const createWorkWithZeroes = async (
  taskName: string,
  section: string,
  apartments: string[]
): Promise<boolean> => {
  try {
    if (!taskName || !section || apartments.length === 0) return false;
    const rows = apartments.map(apartmentId => ({
      task_name: taskName,
      section: section,
      apartment_id: apartmentId,
      fact_progress: 0,
      plan_progress: 0,
    }));

    const { error } = await supabase
      .from('progress_data')
      .upsert(rows, { onConflict: 'task_name,section,apartment_id' });

    if (error) {
      console.error('Ошибка массового создания работы:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Ошибка в createWorkWithZeroes:', error);
    return false;
  }
};
