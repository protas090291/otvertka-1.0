import React, { useState, useEffect } from 'react';
import { X, Bell, CheckCircle, FileText, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

export type NotificationType = 'task' | 'report' | 'defect' | 'progress' | 'plan' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  recipient_id: string;
  persistent: boolean;
  read: boolean;
  created_at: string;
  created_by?: string | null;
}

interface NotificationSystemProps {
  currentUserId: string | null;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ currentUserId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Загрузка и подписка на уведомления
  useEffect(() => {
    if (!currentUserId) return;

    // Загрузка существующих непрочитанных уведомлений
    const loadNotifications = async () => {
      try {
        console.log('📥 Загрузка уведомлений для пользователя:', currentUserId);
        
        // Сначала проверяем текущего пользователя из auth
        const { data: { user: authUser } } = await supabase.auth.getUser();
        console.log('🔐 Auth user ID:', authUser?.id);
        console.log('🔐 Current user ID (from props):', currentUserId);
        console.log('🔐 IDs совпадают?', authUser?.id === currentUserId);
        
        // Пробуем загрузить уведомления с обоими ID (на случай если они разные)
        const userIdToUse = authUser?.id || currentUserId;
        console.log('📥 Используем ID для загрузки:', userIdToUse);
        
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', userIdToUse)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('❌ Ошибка загрузки уведомлений:', error);
          console.error('Детали ошибки:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          return;
        }

        console.log('✅ Загружено уведомлений:', data?.length || 0);
        if (data && data.length > 0) {
          console.log('📋 Список уведомлений:', data);
          console.log('📋 Детали первого уведомления:', {
            id: data[0].id,
            recipient_id: data[0].recipient_id,
            currentUserId: currentUserId,
            match: data[0].recipient_id === currentUserId,
            read: data[0].read,
            persistent: data[0].persistent
          });
          setNotifications(data);
        } else {
          console.log('ℹ️ Нет непрочитанных уведомлений');
          // Проверяем, есть ли вообще уведомления для этого пользователя (включая прочитанные)
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const userIdToUse = authUser?.id || currentUserId;
          
          const { data: allData, error: allError } = await supabase
            .from('notifications')
            .select('id, read, recipient_id')
            .eq('recipient_id', userIdToUse)
            .limit(5);
          
          if (allError) {
            console.error('❌ Ошибка проверки всех уведомлений:', allError);
          } else {
            console.log('📊 Всего уведомлений для пользователя (включая прочитанные):', allData?.length || 0);
            if (allData && allData.length > 0) {
              console.log('📊 Примеры:', allData);
            }
          }
        }
      } catch (error) {
        console.error('❌ Критическая ошибка загрузки уведомлений:', error);
      }
    };

    loadNotifications();

    // Подписка на новые уведомления в реальном времени
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupRealtime = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userIdForRealtime = authUser?.id || currentUserId;
      
      console.log('📡 Подписка на Realtime для пользователя:', userIdForRealtime);
      
      channel = supabase
        .channel(`notifications:${userIdForRealtime}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${userIdForRealtime}`
          },
          (payload) => {
            console.log('🔔 Новое уведомление получено в реальном времени:', payload.new);
            const newNotification = payload.new as Notification;
            // Проверяем, что уведомление действительно для этого пользователя
            if (newNotification.recipient_id === userIdForRealtime && !newNotification.read) {
              setNotifications(prev => {
                // Проверяем, нет ли уже такого уведомления (избегаем дубликатов)
                const exists = prev.some(n => n.id === newNotification.id);
                if (exists) {
                  console.log('⚠️ Уведомление уже существует, пропускаем');
                  return prev;
                }
                return [newNotification, ...prev];
              });
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Realtime подписка статус:', status);
        });
    };
    
    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUserId]);

  // Автоматическое удаление временных уведомлений через 3 секунды
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev => {
        const now = Date.now();
        return prev.filter(n => {
          if (n.persistent) return true; // Постоянные не удаляем автоматически
          const createdAt = new Date(n.created_at).getTime();
          const age = now - createdAt;
          return age < 3000; // Временные удаляем через 3 секунды
        });
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const removeNotification = async (id: string) => {
    // Удаляем из базы данных
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
    } catch (error) {
      console.error('Ошибка удаления уведомления:', error);
    }

    // Удаляем из состояния
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAsRead = async (id: string) => {
    // Помечаем как прочитанное в базе данных
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
    } catch (error) {
      console.error('Ошибка пометки уведомления как прочитанного:', error);
    }

    // Обновляем состояние
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  // Не скрываем компонент, если есть currentUserId - он может загружать уведомления
  if (!currentUserId) {
    console.log('⚠️ NotificationSystem: currentUserId отсутствует');
    return null;
  }

  // Для отладки: показываем информацию о состоянии
  console.log('🔍 NotificationSystem состояние:', {
    currentUserId,
    notificationsCount: notifications.length,
    notifications: notifications.map(n => ({ id: n.id, title: n.title, read: n.read }))
  });

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map(notification => {
        const icons = {
          task: CheckCircle,
          report: FileText,
          defect: AlertTriangle,
          progress: TrendingUp,
          plan: Calendar,
          info: Bell
        };
        const Icon = icons[notification.type] || Bell;
        
        const colors = {
          task: 'bg-blue-500/20 border-blue-500/30',
          report: 'bg-purple-500/20 border-purple-500/30',
          defect: 'bg-red-500/20 border-red-500/30',
          progress: 'bg-emerald-500/20 border-emerald-500/30',
          plan: 'bg-amber-500/20 border-amber-500/30',
          info: 'bg-slate-500/20 border-slate-500/30'
        };

        const typeLabels = {
          task: 'Задача',
          report: 'Отчёт',
          defect: 'Дефект',
          progress: 'Прогресс',
          plan: 'План',
          info: 'Информация'
        };

        return (
          <div
            key={notification.id}
            className={`${colors[notification.type]} border rounded-xl p-4 shadow-lg backdrop-blur-md animate-slide-in-right ${
              notification.read ? 'opacity-70' : ''
            }`}
            onMouseEnter={() => !notification.read && markAsRead(notification.id)}
          >
            <div className="flex items-start space-x-3">
              <Icon className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="text-sm font-semibold text-white">
                    {notification.title}
                  </h4>
                  <span className="text-xs text-slate-400">
                    {typeLabels[notification.type]}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {notification.message}
                </p>
              </div>
              {notification.persistent && (
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
                  title="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NotificationSystem;
