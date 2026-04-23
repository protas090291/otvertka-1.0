import { createClient } from '@supabase/supabase-js';

// Шаг 1 деплоя: конфигурация из переменных окружения (см. .env.production и env.example)
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim() || 'https://sesobrtsfuzoimvernct.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim() || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlc29icnRzZnV6b2ltdmVybmN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzQ0NDYsImV4cCI6MjA5MTY1MDQ0Nn0.qWdOgpUaFmiMv3gJ2HmiyfoNsSDQnIMBG4N4ikRYvJM';
const supabaseServiceKey = (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? '').trim() || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlc29icnRzZnV6b2ltdmVybmN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA3NDQ0NiwiZXhwIjoyMDkxNjUwNDQ2fQ.5i9KFa1S7BFpJUwHYF9-H_0FE4vhGvmUfpxJXq-isIk';

const DEFAULT_TIMEOUT = 15000; // Увеличиваем таймаут до 15 секунд

const fetchWithTimeout = async (resource: RequestInfo, options: RequestInit = {}, timeout = DEFAULT_TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    
    if (!response.ok && response.status === 0) {
      throw new Error('Network error: Empty response');
    }
    
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Проверьте подключение к интернету.');
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
};

// Единый storage для всех клиентов (чтобы избежать множественных экземпляров)
const storageKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;

const createSupabaseClient = (key: string, useStorage = true) => {
  const options: any = {
    global: {
      fetch: (resource: RequestInfo, options?: RequestInit) => fetchWithTimeout(resource, options),
    },
  };
  
  // Используем единый storage для обычного клиента
  if (useStorage && typeof window !== 'undefined') {
    options.auth = {
      storage: window.localStorage,
      storageKey: storageKey,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    };
  }
  
  return createClient(supabaseUrl, key, options);
};

// Создаем единые экземпляры клиентов (singleton pattern)
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;
let supabaseAdminInstance: ReturnType<typeof createSupabaseClient> | null = null;

// Инициализируем клиенты один раз при загрузке модуля (singleton pattern)
if (typeof window !== 'undefined') {
  // Браузер - создаём один раз
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient(supabaseAnonKey, true);
  }
  
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createSupabaseClient(supabaseServiceKey, false);
  }
} else {
  // SSR - создаём без storage
  supabaseInstance = createSupabaseClient(supabaseAnonKey, false);
  supabaseAdminInstance = createSupabaseClient(supabaseServiceKey, false);
}

export const supabase = supabaseInstance!;
export const supabaseAdmin = supabaseAdminInstance!;

// Типы для базы данных (адаптированы под существующую структуру)
export interface Drawing {
  id: string
  apartment_id: string
  file_path: string
  file_name?: string
  file_size?: number
  width_px?: number
  height_px?: number
  pages?: number
  source?: string
  uploaded_by?: string
  created_at: string
  file_url?: string // Публичный URL для файла
  // Дополнительные поля для типовых квартир
  apartment_type?: 'typical' | 'individual'
  plan_source_apartment?: string
  is_typical?: boolean
  typical_group?: string
}

// Временные типы для демонстрации (будут заменены на реальные данные)
export interface Apartment {
  id: string
  project_id: string
  apartment_number: string
  floor: number
  area: number
  rooms: number
  status: 'available' | 'sold' | 'reserved'
  price: number
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description: string
  address: string
  status: 'planning' | 'construction' | 'completed'
  total_apartments: number
  created_at: string
  updated_at: string
}
