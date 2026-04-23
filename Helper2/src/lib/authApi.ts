import { supabase, supabaseAdmin } from './supabase';

export type UserRole = 'admin' | 'management' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
  /**
   * Оставлено для совместимости с UI. В новой схеме Supabase колонки is_active нет —
   * все пользователи считаются активными.
   */
  is_active?: boolean;
  /** Устаревшее поле (нет в схеме); оставлено опциональным для совместимости. */
  created_by?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  full_name?: string;
  role: UserRole;
}

/**
 * Вход в систему через Supabase Auth
 */
export const signIn = async (credentials: LoginCredentials): Promise<{ user: UserProfile | null; error: string | null }> => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (authError) {
      // Улучшенная обработка ошибок сети
      if (authError.message.includes('Failed to fetch') || authError.message.includes('ERR_EMPTY_RESPONSE')) {
        return { user: null, error: 'Ошибка подключения к серверу. Проверьте интернет-соединение.' };
      }
      return { user: null, error: authError.message };
    }

    if (!authData.user) {
      return { user: null, error: 'Пользователь не найден' };
    }

    // Получаем профиль пользователя (используем admin клиент для обхода RLS при первом входе)
    let profile = await getUserProfile(authData.user.id);
    
    if (!profile) {
      // Пытаемся получить через admin клиент (обход RLS)
      console.log('Профиль не найден через обычный клиент, проверяем через admin...');
      const { data: adminProfile, error: adminError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      
      if (!adminError && adminProfile) {
        console.log('Профиль найден через admin клиент');
        profile = adminProfile as UserProfile;
      } else {
        // Пытаемся создать профиль вручную, если его нет
        console.log('Профиль не найден, создаём вручную...');
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            email: authData.user.email || credentials.email,
            full_name: authData.user.user_metadata?.full_name || authData.user.email || '',
            role: authData.user.user_metadata?.role || 'user',
          })
          .select()
          .single();
        
        if (createError || !newProfile) {
          console.error('Не удалось создать профиль:', createError);
          return { user: null, error: `Профиль пользователя не найден. Ошибка: ${createError?.message || 'Неизвестная ошибка'}. Обратитесь к администратору.` };
        }
        
        profile = newProfile as UserProfile;
      }
    }
    
    if (!profile) {
      return { user: null, error: 'Профиль пользователя не найден. Обратитесь к администратору для создания профиля.' };
    }

    // Проверка is_active убрана — колонки нет в новой схеме user_profiles.
    return { user: profile, error: null };
  } catch (error: any) {
    console.error('Ошибка входа:', error);
    return { user: null, error: error.message || 'Ошибка входа в систему' };
  }
};

/**
 * Выход из системы
 */
export const signOut = async (): Promise<{ error: string | null }> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (error: any) {
    console.error('Ошибка выхода:', error);
    return { error: error.message || 'Ошибка выхода из системы' };
  }
};

/**
 * Получить текущего авторизованного пользователя
 */
export const getCurrentUser = async (): Promise<{ user: UserProfile | null; error: string | null }> => {
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      // Улучшенная обработка ошибок сети
      if (authError.message.includes('Failed to fetch') || authError.message.includes('ERR_EMPTY_RESPONSE')) {
        return { user: null, error: 'Ошибка подключения к серверу. Проверьте интернет-соединение.' };
      }
      return { user: null, error: authError.message || 'Пользователь не авторизован' };
    }
    
    if (!authUser) {
      return { user: null, error: 'Пользователь не авторизован' };
    }

    // Получаем профиль через admin клиент для обхода RLS (так как RLS отключен, можно использовать обычный клиент)
    let profile: UserProfile | null = null;
    
    // Пробуем через обычный клиент
    profile = await getUserProfile(authUser.id);
    
    if (!profile) {
      // Если не получилось, пробуем через admin клиент (обход RLS)
      console.log('Профиль не найден через обычный клиент, проверяем через admin...');
      const { data: adminProfile, error: adminError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (!adminError && adminProfile) {
        console.log('Профиль найден через admin клиент:', adminProfile);
        profile = adminProfile as UserProfile;
      } else {
        console.error('Ошибка получения профиля через admin:', adminError);
        return { user: null, error: `Профиль пользователя не найден. Ошибка: ${adminError?.message || 'Неизвестная ошибка'}. Обратитесь к администратору.` };
      }
    }
    
    if (!profile) {
      return { user: null, error: 'Профиль пользователя не найден. Обратитесь к администратору.' };
    }
    
    console.log('getCurrentUser: Загружен профиль:', {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
    });

    return { user: profile, error: null };
  } catch (error: any) {
    console.error('Ошибка получения текущего пользователя:', error);
    return { user: null, error: error.message || 'Ошибка получения пользователя' };
  }
};

/**
 * Получить профиль пользователя по ID
 * Используем admin клиент, так как RLS может блокировать доступ
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    // Используем admin клиент для гарантированного доступа (RLS отключен, но на всякий случай)
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Ошибка получения профиля через admin клиент:', error);
      
      // Если профиль не найден, попробуем через обычный клиент
      const { data: normalData, error: normalError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!normalError && normalData) {
        console.log('Профиль найден через обычный клиент');
        return normalData as UserProfile;
      }
      
      return null;
    }

    console.log('getUserProfile: Профиль загружен:', {
      id: data.id,
      email: data.email,
      role: data.role,
    });

    return data as UserProfile;
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    return null;
  }
};

/**
 * Получить все профили пользователей (только для админов)
 */
export const getAllUserProfiles = async (): Promise<{ profiles: UserProfile[]; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { profiles: [], error: error.message };
    }

    return { profiles: (data || []) as UserProfile[], error: null };
  } catch (error: any) {
    console.error('Ошибка получения всех профилей:', error);
    return { profiles: [], error: error.message || 'Ошибка получения списка пользователей' };
  }
};

/**
 * Список пользователей для выбора исполнителя задачи (активные, id + отображаемое имя).
 * Доступен всем, кто может создавать задачи.
 */
export const getAssignableUserProfiles = async (): Promise<{ profiles: UserProfile[]; error: string | null }> => {
  try {
    // Колонки is_active в новой схеме нет — берём все профили.
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, role')
      .order('full_name', { ascending: true, nullsFirst: false });

    if (error) {
      return { profiles: [], error: error.message };
    }
    return { profiles: (data || []) as UserProfile[], error: null };
  } catch (error: any) {
    console.error('Ошибка getAssignableUserProfiles:', error);
    return { profiles: [], error: error?.message || 'Ошибка загрузки списка пользователей' };
  }
};

/**
 * Создать нового пользователя (только для админов)
 */
export const createUser = async (userData: CreateUserData): Promise<{ user: UserProfile | null; error: string | null }> => {
  try {
    // Используем admin клиент для создания пользователя
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true, // Автоматически подтверждаем email
      user_metadata: {
        full_name: userData.full_name || '',
        role: userData.role,
      },
    });

    if (authError || !authData.user) {
      return { user: null, error: authError?.message || 'Ошибка создания пользователя' };
    }

    // Триггер on_auth_user_created мог уже создать профиль — сначала пробуем вставку, при конфликте обновляем.
    // Поля is_active и created_by в новой схеме отсутствуют.
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: userData.email,
        full_name: userData.full_name || userData.email,
        role: userData.role,
      })
      .select()
      .single();

    if (profileError) {
      // Конфликт (профиль уже создан триггером) — обновляем существующий
      if (profileError.code === '23505' || profileError.message?.includes('duplicate') || profileError.message?.includes('unique')) {
        const { data: updatedProfile, error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            full_name: userData.full_name || userData.email,
            role: userData.role,
          })
          .eq('id', authData.user.id)
          .select()
          .single();

        if (updateError) {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return { user: null, error: updateError.message };
        }
        return { user: updatedProfile as UserProfile, error: null };
      }
      // Другая ошибка — откатываем создание пользователя
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return { user: null, error: profileError.message };
    }

    return { user: profileData as UserProfile, error: null };
  } catch (error: any) {
    console.error('Ошибка создания пользователя:', error);
    return { user: null, error: error.message || 'Ошибка создания пользователя' };
  }
};

/**
 * Обновить профиль пользователя (только для админов)
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<Pick<UserProfile, 'full_name' | 'role'>>
): Promise<{ user: UserProfile | null; error: string | null }> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { user: null, error: error.message };
    }

    return { user: data as UserProfile, error: null };
  } catch (error: any) {
    console.error('Ошибка обновления профиля:', error);
    return { user: null, error: error.message || 'Ошибка обновления профиля' };
  }
};

/**
 * Отправить пользователю письмо для сброса пароля (ссылку задать новый пароль).
 * Админ может вызвать для любого пользователя по email.
 */
export const sendPasswordResetEmail = async (email: string): Promise<{ error: string | null }> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/`,
    });
    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    console.error('Ошибка отправки сброса пароля:', err);
    return { error: err?.message || 'Ошибка отправки письма' };
  }
};

/**
 * Удалить пользователя (только для админов)
 */
export const deleteUser = async (userId: string): Promise<{ error: string | null }> => {
  try {
    // Удаляем из auth (это автоматически удалит профиль через CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (error: any) {
    console.error('Ошибка удаления пользователя:', error);
    return { error: error.message || 'Ошибка удаления пользователя' };
  }
};

/**
 * Проверить, является ли пользователь админом
 */
export const isAdmin = (user: UserProfile | null): boolean => {
  return user?.role === 'admin';
};

/**
 * Проверить, является ли пользователь руководством
 */
export const isManagement = (user: UserProfile | null): boolean => {
  return user?.role === 'management';
};

/**
 * Получить доступные модули для пользователя
 */
export const getAvailableModules = (user: UserProfile | null): string[] => {
  if (!user) return [];

  const modules: string[] = [];

  // Все пользователи имеют доступ к модулю "Рабочий состав"
  modules.push('workers');

  // Руководство и админы имеют доступ к модулю "Руководство"
  if (user.role === 'management' || user.role === 'admin') {
    modules.push('management');
  }

  // Только админы имеют доступ к модулю "Администрирование"
  if (user.role === 'admin') {
    modules.push('admin');
  }

  return modules;
};
