import React, { useState, useEffect } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import NotificationsModal from '../NotificationsModal';

interface ManagementHeaderProps {
  onLogout: () => void;
  /** Подпись модуля (по умолчанию УПРАВЛЕНИЕ) */
  badge?: string;
  /** ID текущего пользователя для отображения уведомлений */
  currentUserId?: string | null;
}

const ManagementHeader: React.FC<ManagementHeaderProps> = ({ onLogout, badge = 'УПРАВЛЕНИЕ', currentUserId }) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Загрузка количества непрочитанных уведомлений
  useEffect(() => {
    if (!currentUserId) return;

    const loadUnreadCount = async () => {
      try {
        console.log('📊 Загрузка количества непрочитанных уведомлений для:', currentUserId);
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const userIdToUse = authUser?.id || currentUserId;
        
        console.log('🔐 Auth user ID:', authUser?.id);
        console.log('🔐 Current user ID (from props):', currentUserId);
        console.log('🔐 Используем ID для счётчика:', userIdToUse);

        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', userIdToUse)
          .eq('read', false);

        if (error) {
          console.error('❌ Ошибка загрузки количества уведомлений:', error);
          console.error('Детали ошибки:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          return;
        }

        console.log('✅ Количество непрочитанных уведомлений:', count || 0);
        setUnreadCount(count || 0);
      } catch (error) {
        console.error('❌ Критическая ошибка загрузки количества уведомлений:', error);
      }
    };

    loadUnreadCount();

    // Подписка на изменения уведомлений в реальном времени
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupRealtime = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userIdForRealtime = authUser?.id || currentUserId;

      channel = supabase
        .channel(`notifications-count:${userIdForRealtime}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${userIdForRealtime}`
          },
          () => {
            // Перезагружаем количество при любом изменении
            loadUnreadCount();
          }
        )
        .subscribe();
    };

    setupRealtime();

    // Периодическое обновление (на случай если Realtime не сработает)
    const interval = setInterval(loadUnreadCount, 10000); // Каждые 10 секунд

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      clearInterval(interval);
    };
  }, [currentUserId]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-900/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center space-x-3">
          <div className="rounded-2xl bg-gradient-to-r from-blue-500/30 to-indigo-400/30 px-3 py-1 text-[11px] uppercase tracking-[0.4em] text-blue-100 font-semibold">
            {badge}
          </div>
          <h1 className="text-xl font-semibold text-white">Отвёртка</h1>
        </div>

        <div className="flex items-center space-x-2 text-slate-200">
          {/* Кнопка уведомлений */}
          <button
            onClick={() => setShowNotificationsModal(true)}
            className="relative rounded-2xl border border-white/5 bg-white/5 p-2 transition hover:border-white/15 hover:bg-white/10"
            title="Уведомления"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20"
          >
            <LogOut className="h-4 w-4" />
            Выход
          </button>
        </div>
      </div>
      
      {/* Модальное окно уведомлений */}
      {currentUserId && (
        <NotificationsModal
          isOpen={showNotificationsModal}
          onClose={() => setShowNotificationsModal(false)}
          currentUserId={currentUserId}
          onNotificationRead={() => {
            // Перезагружаем счётчик при прочтении уведомления
            const loadUnreadCount = async () => {
              try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                const userIdToUse = authUser?.id || currentUserId;

                const { count, error } = await supabase
                  .from('notifications')
                  .select('*', { count: 'exact', head: true })
                  .eq('recipient_id', userIdToUse)
                  .eq('read', false);

                if (!error) {
                  setUnreadCount(count || 0);
                }
              } catch (error) {
                console.error('Ошибка загрузки количества уведомлений:', error);
              }
            };
            loadUnreadCount();
          }}
        />
      )}
    </header>
  );
};

export default ManagementHeader;


