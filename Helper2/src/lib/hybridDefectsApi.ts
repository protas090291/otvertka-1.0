import { supabase } from './supabase';
import { SupabaseDefect, DbDefectStatus } from '../types';

// Гибридный API для дефектов - пытается использовать Supabase, при ошибке переключается на localStorage

const STORAGE_KEY = 'defects_data';
const DEFECT_PHOTOS_BUCKET = 'defects_images';
let useSupabase = true; // Флаг для переключения между Supabase и localStorage

// ===== МАППИНГ СТАТУСОВ =====
// UI использует пару 'active' | 'fixed' и детальный 'open' | 'in-progress' | 'resolved' | 'closed'.
// DB использует enum DefectStatus: 'opened' | 'active' | 'resolved' | 'canceled'.

const uiToDbStatus = (
  status: 'active' | 'fixed' | 'open' | 'in-progress' | 'resolved' | 'closed' | undefined
): DbDefectStatus => {
  switch (status) {
    case 'open':
    case 'active':
      return 'opened';
    case 'in-progress':
      return 'active';
    case 'resolved':
    case 'fixed':
      return 'resolved';
    case 'closed':
      return 'canceled';
    default:
      return 'opened';
  }
};

const dbToUiStatus = (status: DbDefectStatus | string): 'active' | 'fixed' => {
  return status === 'resolved' || status === 'canceled' ? 'fixed' : 'active';
};

const dbToUiStatusDetail = (
  status: DbDefectStatus | string
): 'open' | 'in-progress' | 'resolved' | 'closed' => {
  switch (status) {
    case 'opened':
      return 'open';
    case 'active':
      return 'in-progress';
    case 'resolved':
      return 'resolved';
    case 'canceled':
      return 'closed';
    default:
      return 'open';
  }
};

// Получить id текущего пользователя (для NOT NULL полей created_by/assigned_to)
const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
};

// Привести ряд defect из DB к UI-форме SupabaseDefect
const mapDbRowToDefect = (row: any, photoUrl?: string | null): SupabaseDefect => ({
  id: row.id,
  apartment_id: row.apartment_id,
  title: row.title,
  description: row.description ?? null,
  photo_url: photoUrl ?? null,
  status: dbToUiStatus(row.status),
  status_detail: dbToUiStatusDetail(row.status),
  severity: row.severity,
  assigned_to: row.assigned_to ?? null,
  created_by: row.created_by ?? null,
  due_date: row.due_date ?? null,
  x_coord: Number(row.x_coord),
  y_coord: Number(row.y_coord),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// Подтягивает первое фото дефекта из таблицы defect_images (если есть)
const fetchFirstPhotoMap = async (defectIds: string[]): Promise<Record<string, string>> => {
  if (defectIds.length === 0) return {};
  const { data, error } = await supabase
    .from('defect_images')
    .select('defect_id, url, created_at')
    .in('defect_id', defectIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Не удалось получить defect_images:', error.message);
    return {};
  }
  const map: Record<string, string> = {};
  (data || []).forEach((img: any) => {
    if (!map[img.defect_id]) map[img.defect_id] = img.url;
  });
  return map;
};

// Функция для проверки доступности Supabase (только чтение — не требует прав на INSERT)
const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('defects')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('❌ Supabase таблица defects недоступна:', error.message);
      return false;
    }
    console.log('✅ Supabase таблица defects доступна');
    return true;
  } catch (error) {
    console.warn('❌ Supabase недоступен:', error);
    return false;
  }
};

// Инициализация - проверяем доступность Supabase
const initializeApi = async () => {
  const isSupabaseAvailable = await checkSupabaseConnection();
  useSupabase = isSupabaseAvailable;
  console.log(useSupabase
    ? '✅ Используем Supabase для хранения дефектов'
    : '📦 Используем localStorage для хранения дефектов');
};

initializeApi();

// === ФУНКЦИИ ДЛЯ SUPABASE ===

const supabaseGetAllDefects = async (): Promise<SupabaseDefect[]> => {
  const { data, error } = await supabase
    .from('defects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка получения дефектов из Supabase:', error);
    throw error;
  }

  const rows = data || [];
  const photoMap = await fetchFirstPhotoMap(rows.map((r: any) => r.id));
  return rows.map((row: any) => mapDbRowToDefect(row, photoMap[row.id]));
};

const supabaseGetDefectsByApartment = async (apartmentId: string): Promise<SupabaseDefect[]> => {
  const { data, error } = await supabase
    .from('defects')
    .select('*')
    .eq('apartment_id', apartmentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка получения дефектов по квартире из Supabase:', error);
    throw error;
  }

  const rows = data || [];
  const photoMap = await fetchFirstPhotoMap(rows.map((r: any) => r.id));
  return rows.map((row: any) => mapDbRowToDefect(row, photoMap[row.id]));
};

const supabaseCreateDefect = async (
  defect: Omit<SupabaseDefect, 'id' | 'created_at' | 'updated_at'>
): Promise<SupabaseDefect | null> => {
  const currentUserId = await getCurrentUserId();

  // Обязательные NOT NULL поля в DB: apartment_id, assigned_to, created_by, due_date, x_coord, y_coord
  const dueDate = defect.due_date
    ? defect.due_date
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const payload: any = {
    apartment_id: defect.apartment_id,
    title: defect.title,
    description: defect.description ?? '',
    x_coord: defect.x_coord,
    y_coord: defect.y_coord,
    status: uiToDbStatus(defect.status_detail || defect.status),
    severity: defect.severity || 'medium',
    assigned_to: defect.assigned_to || currentUserId,
    created_by: defect.created_by || currentUserId,
    due_date: dueDate,
  };

  // Если нет id пользователя — это почти наверняка сломает insert из-за FK.
  if (!payload.assigned_to || !payload.created_by) {
    console.warn('⚠️ Не удалось определить user id для created_by/assigned_to. Insert скорее всего упадёт (FK user_profiles).');
  }

  const { data, error } = await supabase
    .from('defects')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Ошибка создания дефекта в Supabase:', error);
    throw error;
  }

  const created = mapDbRowToDefect(data);

  // Если было фото — добавим отдельной записью в defect_images
  if (defect.photo_url) {
    const { error: imgErr } = await supabase
      .from('defect_images')
      .insert([{ defect_id: created.id, url: defect.photo_url }]);
    if (imgErr) {
      console.warn('Не удалось сохранить запись в defect_images:', imgErr.message);
    } else {
      created.photo_url = defect.photo_url;
    }
  }

  return created;
};

const supabaseUpdateDefect = async (
  defectId: string,
  updates: Partial<Omit<SupabaseDefect, 'id' | 'created_at' | 'updated_at'>>
): Promise<SupabaseDefect | null> => {
  const payload: any = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description ?? '';
  if (updates.x_coord !== undefined) payload.x_coord = updates.x_coord;
  if (updates.y_coord !== undefined) payload.y_coord = updates.y_coord;
  if (updates.severity !== undefined) payload.severity = updates.severity;
  if (updates.assigned_to !== undefined) payload.assigned_to = updates.assigned_to;
  if (updates.due_date !== undefined) payload.due_date = updates.due_date;
  if (updates.apartment_id !== undefined) payload.apartment_id = updates.apartment_id;
  if (updates.status_detail !== undefined) {
    payload.status = uiToDbStatus(updates.status_detail);
  } else if (updates.status !== undefined) {
    payload.status = uiToDbStatus(updates.status);
  }

  const { data, error } = await supabase
    .from('defects')
    .update(payload)
    .eq('id', defectId)
    .select()
    .single();

  if (error) {
    console.error('Ошибка обновления дефекта в Supabase:', error);
    throw error;
  }

  // Если обновлялся photo_url — положим в defect_images
  if (updates.photo_url) {
    const { error: imgErr } = await supabase
      .from('defect_images')
      .insert([{ defect_id: defectId, url: updates.photo_url }]);
    if (imgErr) {
      console.warn('Не удалось сохранить запись в defect_images:', imgErr.message);
    }
  }

  const photoMap = await fetchFirstPhotoMap([defectId]);
  return mapDbRowToDefect(data, photoMap[defectId]);
};

const supabaseUpdateDefectStatus = async (
  defectId: string,
  status: 'active' | 'fixed' | 'open' | 'in-progress' | 'resolved' | 'closed'
): Promise<SupabaseDefect | null> => {
  return supabaseUpdateDefect(defectId, {
    status: status === 'active' || status === 'open' || status === 'in-progress' ? 'active' : 'fixed',
    status_detail: (status === 'active' ? 'open' : status === 'fixed' ? 'resolved' : status) as
      | 'open'
      | 'in-progress'
      | 'resolved'
      | 'closed',
  });
};

const supabaseDeleteDefect = async (defectId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('defects')
    .delete()
    .eq('id', defectId);

  if (error) {
    console.error('Ошибка удаления дефекта из Supabase:', error);
    throw error;
  }

  return true;
};

const supabaseUploadDefectPhoto = async (file: File, defectId: string): Promise<string | null> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${defectId}-${Date.now()}.${fileExt}`;
  // Файлы хранятся в корне бакета
  const filePath = fileName;

  const { error } = await supabase.storage
    .from(DEFECT_PHOTOS_BUCKET)
    .upload(filePath, file);

  if (error) {
    console.error('Ошибка загрузки фото в Supabase Storage:', error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from(DEFECT_PHOTOS_BUCKET)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
};

// === ФУНКЦИИ ДЛЯ LOCALSTORAGE ===

const localStorageGetAllDefects = async (): Promise<SupabaseDefect[]> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Ошибка получения дефектов из localStorage:', error);
    return [];
  }
};

const localStorageGetDefectsByApartment = async (apartmentId: string): Promise<SupabaseDefect[]> => {
  try {
    const allDefects = await localStorageGetAllDefects();
    return allDefects.filter(defect => defect.apartment_id === apartmentId);
  } catch (error) {
    console.error('Ошибка получения дефектов по квартире из localStorage:', error);
    return [];
  }
};

const localStorageCreateDefect = async (
  defect: Omit<SupabaseDefect, 'id' | 'created_at' | 'updated_at'>
): Promise<SupabaseDefect | null> => {
  try {
    const allDefects = await localStorageGetAllDefects();

    const newDefect: SupabaseDefect = {
      id: `defect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...defect,
      status_detail: defect.status_detail || 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    allDefects.push(newDefect);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allDefects));

    return newDefect;
  } catch (error) {
    console.error('Ошибка создания дефекта в localStorage:', error);
    return null;
  }
};

const localStorageUpdateDefect = async (
  defectId: string,
  updates: Partial<Omit<SupabaseDefect, 'id' | 'created_at' | 'updated_at'>>
): Promise<SupabaseDefect | null> => {
  try {
    const allDefects = await localStorageGetAllDefects();
    const defectIndex = allDefects.findIndex(d => d.id === defectId);

    if (defectIndex === -1) {
      console.error('Дефект не найден в localStorage:', defectId);
      return null;
    }

    allDefects[defectIndex] = {
      ...allDefects[defectIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allDefects));
    return allDefects[defectIndex];
  } catch (error) {
    console.error('Ошибка обновления дефекта в localStorage:', error);
    return null;
  }
};

const localStorageUpdateDefectStatus = async (
  defectId: string,
  status: 'active' | 'fixed' | 'open' | 'in-progress' | 'resolved' | 'closed'
): Promise<SupabaseDefect | null> => {
  const statusMapping: { [key: string]: 'active' | 'fixed' } = {
    open: 'active',
    'in-progress': 'active',
    resolved: 'fixed',
    closed: 'fixed',
    active: 'active',
    fixed: 'fixed',
  };

  const mappedStatus = statusMapping[status] || 'active';

  return localStorageUpdateDefect(defectId, {
    status: mappedStatus,
    status_detail: status as 'open' | 'in-progress' | 'resolved' | 'closed',
  });
};

const localStorageDeleteDefect = async (defectId: string): Promise<boolean> => {
  try {
    const allDefects = await localStorageGetAllDefects();
    const filteredDefects = allDefects.filter(d => d.id !== defectId);

    if (filteredDefects.length === allDefects.length) {
      return false;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredDefects));
    return true;
  } catch (error) {
    console.error('Ошибка удаления дефекта из localStorage:', error);
    return false;
  }
};

const localStorageUploadDefectPhoto = async (file: File): Promise<string | null> => {
  try {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error('Ошибка загрузки фото в localStorage:', error);
    return null;
  }
};

// === ОСНОВНЫЕ ФУНКЦИИ API ===

export const getAllDefects = async (): Promise<SupabaseDefect[]> => {
  try {
    if (useSupabase) return await supabaseGetAllDefects();
    return await localStorageGetAllDefects();
  } catch (error) {
    console.warn('Ошибка в Supabase, временно используем localStorage для этого запроса:', error);
    return await localStorageGetAllDefects();
  }
};

export const getDefectsByApartment = async (apartmentId: string): Promise<SupabaseDefect[]> => {
  try {
    if (useSupabase) return await supabaseGetDefectsByApartment(apartmentId);
    return await localStorageGetDefectsByApartment(apartmentId);
  } catch (error) {
    console.warn('Ошибка в Supabase, переключаемся на localStorage');
    useSupabase = false;
    return await localStorageGetDefectsByApartment(apartmentId);
  }
};

export const createDefect = async (
  defect: Omit<SupabaseDefect, 'id' | 'created_at' | 'updated_at'>
): Promise<SupabaseDefect | null> => {
  try {
    if (useSupabase) {
      const result = await supabaseCreateDefect(defect);
      if (result) return result;
      throw new Error('Supabase create failed');
    }
    return await localStorageCreateDefect(defect);
  } catch (error) {
    console.warn('Ошибка в Supabase, переключаемся на localStorage:', error);
    useSupabase = false;
    return await localStorageCreateDefect(defect);
  }
};

export const updateDefect = async (
  defectId: string,
  updates: Partial<Omit<SupabaseDefect, 'id' | 'created_at' | 'updated_at'>>
): Promise<SupabaseDefect | null> => {
  try {
    if (useSupabase) return await supabaseUpdateDefect(defectId, updates);
    return await localStorageUpdateDefect(defectId, updates);
  } catch (error) {
    console.warn('Ошибка в Supabase, временно используем localStorage для этого запроса:', error);
    return await localStorageUpdateDefect(defectId, updates);
  }
};

export const updateDefectStatus = async (
  defectId: string,
  status: 'active' | 'fixed' | 'open' | 'in-progress' | 'resolved' | 'closed'
): Promise<SupabaseDefect | null> => {
  try {
    if (useSupabase) return await supabaseUpdateDefectStatus(defectId, status);
    return await localStorageUpdateDefectStatus(defectId, status);
  } catch (error) {
    console.warn('Ошибка в Supabase, временно используем localStorage для этого запроса:', error);
    return await localStorageUpdateDefectStatus(defectId, status);
  }
};

export const deleteDefect = async (defectId: string): Promise<boolean> => {
  try {
    if (useSupabase) return await supabaseDeleteDefect(defectId);
    return await localStorageDeleteDefect(defectId);
  } catch (error) {
    console.warn('Ошибка в Supabase, переключаемся на localStorage');
    useSupabase = false;
    return await localStorageDeleteDefect(defectId);
  }
};

export const uploadDefectPhoto = async (file: File, defectId: string): Promise<string | null> => {
  try {
    if (useSupabase) return await supabaseUploadDefectPhoto(file, defectId);
    return await localStorageUploadDefectPhoto(file);
  } catch (error) {
    console.warn('Ошибка в Supabase, временно используем localStorage для этого запроса:', error);
    return await localStorageUploadDefectPhoto(file);
  }
};

export const getDefectsStats = async (): Promise<{
  total: number;
  active: number;
  fixed: number;
  byApartment: { [apartmentId: string]: number };
}> => {
  try {
    const allDefects = await getAllDefects();

    const stats = {
      total: allDefects.length,
      active: allDefects.filter(d => d.status === 'active').length,
      fixed: allDefects.filter(d => d.status === 'fixed').length,
      byApartment: {} as { [apartmentId: string]: number },
    };

    allDefects.forEach(defect => {
      stats.byApartment[defect.apartment_id] = (stats.byApartment[defect.apartment_id] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Ошибка получения статистики дефектов:', error);
    return { total: 0, active: 0, fixed: 0, byApartment: {} };
  }
};

// Функция для принудительного переключения на localStorage
export const forceLocalStorage = () => {
  useSupabase = false;
  console.log('🔄 Принудительно переключились на localStorage');
};

// Принудительно использовать базу данных (Supabase)
export const forceUseSupabase = () => {
  useSupabase = true;
  console.log('🔄 Принудительно переключились на Supabase (база данных)');
};

// Функция для проверки текущего режима
export const getCurrentMode = () => {
  return useSupabase ? 'Supabase' : 'localStorage';
};

// Функция для принудительной проверки Supabase (для отладки и кнопки «Использовать БД»)
export const forceCheckSupabase = async () => {
  console.log('🔄 Проверка подключения к Supabase...');
  const isAvailable = await checkSupabaseConnection();
  useSupabase = isAvailable;
  console.log(`📊 Режим: ${useSupabase ? 'Supabase (база данных)' : 'localStorage'}`);
  return isAvailable;
};
