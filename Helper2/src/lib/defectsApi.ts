import { supabase, supabaseAdmin } from './supabase';
import { SupabaseDefect } from '../types';

// API функции для работы с дефектами в Supabase

/**
 * Получить все дефекты для конкретной квартиры
 */
export const getDefectsByApartment = async (apartmentId: string): Promise<SupabaseDefect[]> => {
  try {
    const { data, error } = await supabase
      .from('defects')
      .select('*')
      .eq('apartment_id', apartmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка получения дефектов:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getDefectsByApartment:', error);
    return [];
  }
};

/**
 * Получить все дефекты
 */
export const getAllDefects = async (): Promise<SupabaseDefect[]> => {
  try {
    const { data, error } = await supabase
      .from('defects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка получения всех дефектов:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getAllDefects:', error);
    return [];
  }
};

/**
 * Создать новый дефект
 */
export const createDefect = async (defect: Omit<SupabaseDefect, 'id' | 'created_at' | 'updated_at'>): Promise<SupabaseDefect | null> => {
  try {
    const { data, error } = await supabase
      .from('defects')
      .insert([defect])
      .select()
      .single();

    if (error) {
      console.error('Ошибка создания дефекта:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Ошибка в createDefect:', error);
    return null;
  }
};

/**
 * Обновить статус дефекта
 * Примечание: DB enum = 'opened' | 'active' | 'resolved' | 'canceled'.
 * UI передаёт 'active' | 'fixed', маппим на 'opened' и 'resolved' соответственно.
 */
export const updateDefectStatus = async (defectId: string, status: 'active' | 'fixed'): Promise<SupabaseDefect | null> => {
  try {
    const dbStatus = status === 'fixed' ? 'resolved' : 'opened';
    const { data, error } = await supabase
      .from('defects')
      .update({ status: dbStatus })
      .eq('id', defectId)
      .select()
      .single();

    if (error) {
      console.error('Ошибка обновления статуса дефекта:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Ошибка в updateDefectStatus:', error);
    return null;
  }
};

/**
 * Обновить дефект
 */
export const updateDefect = async (defectId: string, updates: Partial<Omit<SupabaseDefect, 'id' | 'created_at' | 'updated_at'>>): Promise<SupabaseDefect | null> => {
  try {
    const { data, error } = await supabase
      .from('defects')
      .update(updates)
      .eq('id', defectId)
      .select()
      .single();

    if (error) {
      console.error('Ошибка обновления дефекта:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Ошибка в updateDefect:', error);
    return null;
  }
};

/**
 * Удалить дефект
 */
export const deleteDefect = async (defectId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('defects')
      .delete()
      .eq('id', defectId);

    if (error) {
      console.error('Ошибка удаления дефекта:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Ошибка в deleteDefect:', error);
    return false;
  }
};

/**
 * Загрузить фото дефекта в Supabase Storage
 */
export const uploadDefectPhoto = async (file: File, defectId: string): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${defectId}-${Date.now()}.${fileExt}`;
    // Файлы хранятся в корне бакета defects_images
    const filePath = fileName;

    const { error } = await supabase.storage
      .from('defects_images')
      .upload(filePath, file);

    if (error) {
      console.error('Ошибка загрузки фото:', error);
      throw error;
    }

    // Получаем публичный URL
    const { data: urlData } = supabase.storage
      .from('defects_images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Ошибка в uploadDefectPhoto:', error);
    return null;
  }
};

/**
 * Получить статистику дефектов
 */
export const getDefectsStats = async (): Promise<{
  total: number;
  active: number;
  fixed: number;
  byApartment: { [apartmentId: string]: number };
}> => {
  try {
    const { data, error } = await supabase
      .from('defects')
      .select('apartment_id, status');

    if (error) {
      console.error('Ошибка получения статистики дефектов:', error);
      throw error;
    }

    const stats = {
      total: data?.length || 0,
      active: data?.filter(d => d.status === 'active').length || 0,
      fixed: data?.filter(d => d.status === 'fixed').length || 0,
      byApartment: {} as { [apartmentId: string]: number }
    };

    // Подсчитываем дефекты по квартирам
    data?.forEach(defect => {
      stats.byApartment[defect.apartment_id] = (stats.byApartment[defect.apartment_id] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Ошибка в getDefectsStats:', error);
    return {
      total: 0,
      active: 0,
      fixed: 0,
      byApartment: {}
    };
  }
};
