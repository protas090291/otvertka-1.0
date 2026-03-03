import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, CheckCircle, FileText, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { markNotificationAsRead, deleteNotification } from '../lib/notificationsApi';

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

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string | null;
  onNotificationRead?: () => void; // Callback для обновления счётчика
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, currentUserId, onNotificationRead }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // Закрытие по Escape
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Загрузка всех уведомлений (и прочитанных, и непрочитанных)
  useEffect(() => {
    if (!isOpen || !currentUserId) return;

    const loadNotifications = async () => {
      setLoading(true);
      try {
        console.log('📥 Загрузка уведомлений в модальном окне для пользователя:', currentUserId);
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const userIdToUse = authUser?.id || currentUserId;
        
        console.log('🔐 Auth user ID:', authUser?.id);
        console.log('🔐 Current user ID (from props):', currentUserId);
        console.log('🔐 Используем ID:', userIdToUse);

        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', userIdToUse)
          .order('created_at', { ascending: false })
          .limit(100);

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

        console.log('✅ Загружено уведомлений в модальном окне:', data?.length || 0);
        if (data && data.length > 0) {
          console.log('📋 Список уведомлений:', data.map(n => ({
            id: n.id,
            title: n.title,
            recipient_id: n.recipient_id,
            read: n.read
          })));
        }
        setNotifications(data || []);
      } catch (error) {
        console.error('❌ Критическая ошибка загрузки уведомлений:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();

    // Подписка на новые уведомления в реальном времени
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupRealtime = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userIdForRealtime = authUser?.id || currentUserId;

      channel = supabase
        .channel(`notifications-modal:${userIdForRealtime}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${userIdForRealtime}`
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isOpen, currentUserId]);

  const handleMarkAsRead = async (notificationId: string) => {
    const success = await markNotificationAsRead(notificationId);
    if (success) {
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      // Уведомляем родительский компонент об обновлении
      onNotificationRead?.();
    }
  };

  const handleDelete = async (notificationId: string) => {
    const success = await deleteNotification(notificationId);
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;
  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  const icons = {
    task: CheckCircle,
    report: FileText,
    defect: AlertTriangle,
    progress: Calendar,
    plan: Calendar,
    info: Bell
  };

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

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30 flex-shrink-0">
              <Bell className="w-6 h-6 text-blue-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white">Уведомления</h2>
              {unreadCount > 0 && (
                <p className="text-sm text-slate-400 mt-0.5">
                  {unreadCount} непрочитан{unreadCount === 1 ? 'ное' : unreadCount < 5 ? 'ных' : 'ных'}
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-500 text-white flex-shrink-0">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors ml-4 flex-shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Список уведомлений */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mb-4 border-2 border-slate-600/50">
                <Bell className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-300 text-lg font-semibold">Нет уведомлений</p>
              <p className="text-slate-500 text-sm mt-2">Новые задачи и отчёты будут появляться здесь</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Непрочитанные уведомления */}
              {unreadNotifications.length > 0 && (
                <>
                  <div className="flex items-center space-x-2 mb-3 px-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                      Непрочитанные ({unreadNotifications.length})
                    </h3>
                  </div>
                  {unreadNotifications.map(notification => {
                    const Icon = icons[notification.type] || Bell;
                    return (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`${colors[notification.type]} border-2 border-slate-500/50 rounded-xl p-5 cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all bg-slate-800/80`}
                      >
                        <div className="flex items-start space-x-4">
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 flex-shrink-0">
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="text-base font-bold text-white">
                                {notification.title}
                              </h4>
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-white/10 text-slate-200 border border-white/20">
                                {typeLabels[notification.type]}
                              </span>
                            </div>
                            <p className="text-sm text-slate-200 mb-3 leading-relaxed">
                              {notification.message}
                            </p>
                            <div className="flex items-center space-x-2">
                              <p className="text-xs text-slate-400 font-medium">
                                {new Date(notification.created_at).toLocaleString('ru', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                              <span className="text-xs text-blue-300 font-semibold">Новое</span>
                            </div>
                          </div>
                          {notification.persistent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(notification.id);
                              }}
                              className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-all"
                              title="Удалить"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Прочитанные уведомления */}
              {readNotifications.length > 0 && (
                <>
                  {unreadNotifications.length > 0 && (
                    <div className="my-6 border-t-2 border-white/10"></div>
                  )}
                  <div className="flex items-center space-x-2 mb-3 px-2">
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide">
                      Прочитанные ({readNotifications.length})
                    </h3>
                  </div>
                  {readNotifications.map(notification => {
                    const Icon = icons[notification.type] || Bell;
                    return (
                      <div
                        key={notification.id}
                        className={`${colors[notification.type]} border border-slate-600/30 rounded-xl p-5 bg-slate-800/60 hover:bg-slate-800/80 transition-all`}
                      >
                        <div className="flex items-start space-x-4">
                          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 flex-shrink-0">
                            <Icon className="w-5 h-5 text-slate-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="text-base font-semibold text-slate-300">
                                {notification.title}
                              </h4>
                              <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-white/5 text-slate-400 border border-white/10">
                                {typeLabels[notification.type]}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 mb-3 leading-relaxed">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-500 font-medium">
                              {new Date(notification.created_at).toLocaleString('ru', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          {notification.persistent && (
                            <button
                              onClick={() => handleDelete(notification.id)}
                              className="flex-shrink-0 p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/20 transition-all"
                              title="Удалить"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NotificationsModal;
