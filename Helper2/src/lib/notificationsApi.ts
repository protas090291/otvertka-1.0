import { supabase } from './supabase';

export type NotificationType = 'task' | 'report' | 'defect' | 'progress' | 'plan' | 'info';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  recipientId: string;
  persistent: boolean;
  createdBy?: string | null;
}

/**
 * Создать уведомление в базе данных
 * Уведомление автоматически появится у получателя через Supabase Realtime
 */
export const createNotification = async (input: NotificationInput): Promise<boolean> => {
  try {
    console.log('📝 Создание уведомления:', {
      type: input.type,
      recipientId: input.recipientId,
      persistent: input.persistent,
      title: input.title
    });

    // Используем функцию базы данных для создания уведомлений
    // Это обходит RLS, так как функция выполняется с правами SECURITY DEFINER
    const { data: notificationId, error } = await supabase.rpc('create_notification', {
      p_recipient_id: input.recipientId,
      p_type: input.type,
      p_title: input.title,
      p_message: input.message,
      p_persistent: input.persistent,
      p_created_by: input.createdBy || null
    });

    if (error) {
      console.error('❌ Ошибка создания уведомления через функцию:', error);
      console.error('Детали ошибки:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return false;
    }

    if (!notificationId) {
      console.error('❌ Функция не вернула ID уведомления');
      return false;
    }

    console.log('✅ Уведомление успешно создано через функцию, ID:', notificationId);
    return true;
  } catch (error) {
    console.error('❌ Критическая ошибка создания уведомления:', error);
    return false;
  }
};

/**
 * Получить все уведомления для пользователя
 */
export const getUserNotifications = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Ошибка загрузки уведомлений:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка загрузки уведомлений:', error);
    return [];
  }
};

/**
 * Пометить уведомление как прочитанное
 */
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Ошибка пометки уведомления как прочитанного:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Ошибка пометки уведомления как прочитанного:', error);
    return false;
  }
};

/**
 * Удалить уведомление
 */
export const deleteNotification = async (notificationId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Ошибка удаления уведомления:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Ошибка удаления уведомления:', error);
    return false;
  }
};
