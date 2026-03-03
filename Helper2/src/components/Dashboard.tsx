import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  DollarSign,
  AlertTriangle,
  Calendar,
  Users,
  Building2,
  CheckCircle,
  FileText,
  Package,
  Plus,
  Eye,
  Wrench,
  ClipboardCheck,
  ShoppingCart,
  BarChart3,
  MessageSquare,
  CheckSquare,
  AlertCircle
} from 'lucide-react';
import { UserRole } from '../types';
import ProjectCard from './ProjectCard';
import KPIChart from './KPIChart';
import { getRecentActivities, formatTimeAgo, Activity } from '../lib/activityApi';

interface QuickAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  iconColor: string;
  onClick: () => void;
}

interface DashboardProps {
  userRole: UserRole;
  onNavigate?: (view: string) => void;
}

// Функция для получения быстрых действий в зависимости от роли
const getQuickActions = (userRole: UserRole, onNavigate?: (view: string) => void): QuickAction[] => {
  const navigate = (view: string) => {
    if (onNavigate) {
      onNavigate(view);
    } else {
      console.log(`Навигация к: ${view}`);
    }
  };

  const actions: Record<UserRole, QuickAction[]> = {
    client: [
      {
        label: 'Создать задачу для подрядчика',
        icon: Calendar,
        bgColor: 'bg-blue-100',
        iconColor: 'text-blue-600',
        onClick: () => navigate('schedule')
      },
      {
        label: 'Добавить дефект',
        icon: AlertTriangle,
        bgColor: 'bg-red-100',
        iconColor: 'text-red-600',
        onClick: () => navigate('defects')
      },
      {
        label: 'Просмотреть отчеты',
        icon: FileText,
        bgColor: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        onClick: () => navigate('reports')
      },
      {
        label: 'Просмотреть бюджет',
        icon: DollarSign,
        bgColor: 'bg-green-100',
        iconColor: 'text-green-600',
        onClick: () => navigate('budget')
      }
    ],
    foreman: [
      {
        label: 'Создать задачу для рабочего',
        icon: Plus,
        bgColor: 'bg-blue-100',
        iconColor: 'text-blue-600',
        onClick: () => navigate('schedule')
      },
      {
        label: 'Обновить прогресс',
        icon: TrendingUp,
        bgColor: 'bg-green-100',
        iconColor: 'text-green-600',
        onClick: () => navigate('schedule')
      },
      {
        label: 'Добавить отчет',
        icon: FileText,
        bgColor: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        onClick: () => navigate('reports')
      },
      {
        label: 'Просмотреть материалы',
        icon: Package,
        bgColor: 'bg-amber-100',
        iconColor: 'text-amber-600',
        onClick: () => navigate('materials')
      }
    ],
    contractor: [
      {
        label: 'Создать задачу',
        icon: Plus,
        bgColor: 'bg-blue-100',
        iconColor: 'text-blue-600',
        onClick: () => navigate('schedule')
      },
      {
        label: 'Добавить отчет',
        icon: FileText,
        bgColor: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        onClick: () => navigate('reports')
      },
      {
        label: 'Просмотреть бюджет',
        icon: DollarSign,
        bgColor: 'bg-green-100',
        iconColor: 'text-green-600',
        onClick: () => navigate('budget')
      },
      {
        label: 'Заказать материалы',
        icon: ShoppingCart,
        bgColor: 'bg-amber-100',
        iconColor: 'text-amber-600',
        onClick: () => navigate('materials')
      }
    ],
    worker: [
      {
        label: 'Обновить прогресс задачи',
        icon: TrendingUp,
        bgColor: 'bg-green-100',
        iconColor: 'text-green-600',
        onClick: () => navigate('schedule')
      },
      {
        label: 'Просмотреть мои задачи',
        icon: CheckCircle,
        bgColor: 'bg-blue-100',
        iconColor: 'text-blue-600',
        onClick: () => navigate('schedule')
      },
      {
        label: 'Добавить комментарий к дефекту',
        icon: MessageSquare,
        bgColor: 'bg-orange-100',
        iconColor: 'text-orange-600',
        onClick: () => navigate('defects')
      }
    ],
    storekeeper: [
      {
        label: 'Добавить материал',
        icon: Plus,
        bgColor: 'bg-blue-100',
        iconColor: 'text-blue-600',
        onClick: () => navigate('materials')
      },
      {
        label: 'Обновить склад',
        icon: Wrench,
        bgColor: 'bg-green-100',
        iconColor: 'text-green-600',
        onClick: () => navigate('materials')
      },
      {
        label: 'Просмотреть заказы',
        icon: ShoppingCart,
        bgColor: 'bg-amber-100',
        iconColor: 'text-amber-600',
        onClick: () => navigate('materials')
      }
    ],
    technadzor: [
      {
        label: 'Добавить дефект',
        icon: AlertTriangle,
        bgColor: 'bg-red-100',
        iconColor: 'text-red-600',
        onClick: () => navigate('architectural-plans')
      },
      {
        label: 'Создать отчет',
        icon: FileText,
        bgColor: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        onClick: () => navigate('reports')
      },
      {
        label: 'Проверить качество',
        icon: ClipboardCheck,
        bgColor: 'bg-purple-100',
        iconColor: 'text-purple-600',
        onClick: () => navigate('defects')
      },
      {
        label: 'Назначить дефект прорабу',
        icon: Users,
        bgColor: 'bg-blue-100',
        iconColor: 'text-blue-600',
        onClick: () => navigate('defects')
      }
    ]
  };

  return actions[userRole] || [];
};

const Dashboard: React.FC<DashboardProps> = ({ userRole, onNavigate }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [projectProgress, setProjectProgress] = useState<number>(0);
  const [projectKPIs, setProjectKPIs] = useState<any>(null);

  // Загружаем прогресс проекта
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const { getProjectProgress } = await import('../lib/tasksApi');
        const progressData = await getProjectProgress('zhk-vishnevyy-sad');
        setProjectProgress(progressData.averageProgress || 0);
        
        // Также загружаем KPI для дополнительных данных
        try {
          const { getProjectKPIs } = await import('../lib/projectsApi');
          const kpis = await getProjectKPIs();
          setProjectKPIs(kpis);
        } catch (kpiError) {
          console.error('Ошибка загрузки KPI:', kpiError);
        }
      } catch (error) {
        console.error('Ошибка загрузки прогресса проекта:', error);
        // В случае ошибки оставляем 0 или можно использовать fallback значение
      }
    };
    loadProgress();
  }, []);

  // Загружаем последние обновления
  useEffect(() => {
    let isMounted = true;
    let lastUpdateTime = 0;
    
    const loadActivities = async (showLoading = false) => {
      // Предотвращаем слишком частые обновления
      const now = Date.now();
      if (!showLoading && now - lastUpdateTime < 5000) {
        return;
      }
      lastUpdateTime = now;
      
      try {
        if (showLoading) {
          setLoadingActivities(true);
        }
        const recentActivities = await getRecentActivities(3);
        if (isMounted) {
          // Обновляем только если данные действительно изменились
          setActivities(prevActivities => {
            const prevIds = prevActivities.map(a => a.id).join(',');
            const newIds = recentActivities.map(a => a.id).join(',');
            if (prevIds === newIds && prevActivities.length === recentActivities.length) {
              return prevActivities; // Данные не изменились
            }
            return recentActivities;
          });
        }
      } catch (error) {
        console.error('Ошибка загрузки последних обновлений:', error);
      } finally {
        if (isMounted && showLoading) {
          setLoadingActivities(false);
        }
      }
    };

    // Первая загрузка с индикатором
    loadActivities(true);
    
    // Обновляем каждые 30 секунд в фоне без показа загрузки
    const interval = setInterval(() => {
      if (isMounted) {
        loadActivities(false);
      }
    }, 30000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const stats = {
    client: [
      { title: 'Активные проекты', value: '1', icon: Building2, color: 'blue' },
      { title: 'Прогресс времени', value: '45%', icon: Calendar, color: 'green' },
      { title: 'Завершение', value: `${projectProgress}%`, icon: TrendingUp, color: 'orange' },
      { title: 'Дней до дедлайна', value: '365', icon: Clock, color: 'red' },
    ],
    foreman: [
      { title: 'Проекты в работе', value: '1', icon: Building2, color: 'blue' },
      { title: 'Активные задачи', value: '15', icon: CheckCircle, color: 'green' },
      { title: 'Команда', value: '12', icon: Users, color: 'purple' },
      { title: 'Просрочки', value: '0', icon: AlertTriangle, color: 'red' },
    ],
    contractor: [
      { title: 'Проекты в работе', value: '1', icon: Building2, color: 'blue' },
      { title: 'Активные задачи', value: '15', icon: CheckCircle, color: 'green' },
      { title: 'Команда', value: '12', icon: Users, color: 'purple' },
      { title: 'Просрочки', value: '0', icon: AlertTriangle, color: 'red' },
    ],
    worker: [
      { title: 'Мои задачи', value: '4', icon: CheckCircle, color: 'blue' },
      { title: 'Выполнено сегодня', value: '2', icon: TrendingUp, color: 'green' },
      { title: 'В работе', value: '2', icon: Clock, color: 'orange' },
      { title: 'Просрочено', value: '0', icon: AlertTriangle, color: 'red' },
    ],
    storekeeper: [
      { title: 'Товары на складе', value: '89', icon: Package, color: 'blue' },
      { title: 'Заказы в обработке', value: '5', icon: Clock, color: 'orange' },
      { title: 'Критический запас', value: '1', icon: AlertTriangle, color: 'red' },
      { title: 'Общая стоимость', value: '₽8.5М', icon: DollarSign, color: 'green' },
    ],
    technadzor: [
      { title: 'Контролируемые проекты', value: '1', icon: Building2, color: 'blue' },
      { title: 'Активные дефекты', value: '3', icon: AlertTriangle, color: 'red' },
      { title: 'Проверки сегодня', value: '4', icon: CheckCircle, color: 'green' },
      { title: 'Отчеты за месяц', value: '12', icon: FileText, color: 'purple' },
    ]
  };

  const recentProjects = [
    {
      id: 'zhk-vishnevyy-sad',
      name: 'ЖК "Вишневый сад"',
      progress: projectProgress,
      status: 'in-progress' as const,
      dueDate: '2026-06-20',
      budget: 180000000,
      spent: 117000000,
      startDate: '2025-06-20',
      endDate: '2026-06-20',
      client: 'ООО "АБ ДЕВЕЛОПМЕНТ ЦЕНТР"',
      foreman: 'Саидов Ю.Н.',
      contractor: 'ООО "СтройМонтаж"',
      architect: 'Петров П.П.',
      description: 'Строительство жилого комплекса'
    }
  ];

  const cardBase = 'rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)]';
  const iconBg = (color: string) =>
    color === 'blue' ? 'bg-blue-500/20' : color === 'green' ? 'bg-emerald-500/20' : color === 'orange' ? 'bg-amber-500/20' : color === 'red' ? 'bg-red-500/20' : color === 'purple' ? 'bg-purple-500/20' : 'bg-slate-500/20';
  const iconColor = (color: string) =>
    color === 'blue' ? 'text-blue-200' : color === 'green' ? 'text-emerald-200' : color === 'orange' ? 'text-amber-200' : color === 'red' ? 'text-red-200' : color === 'purple' ? 'text-purple-200' : 'text-slate-300';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Добро пожаловать в Отвёртку
            </h1>
            <p className="text-slate-400 mt-1">
              Обзор ваших проектов и текущей деятельности
            </p>
          </div>
          <div className="text-xs text-slate-400 bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
            Последнее обновление: {new Date().toLocaleString('ru-RU')}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats[userRole].map((stat, index) => (
          <div key={index} className={`${cardBase} p-6 transition-all duration-300 animate-slide-in`} style={{ animationDelay: `${index * 150}ms` }}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-400 mb-2">{stat.title}</p>
                <p className="text-2xl font-bold text-white mb-2">{stat.value}</p>
                <div className="flex items-center text-xs text-slate-500">
                  <span className="text-emerald-400 mr-1">↗</span>
                  <span>+12% с прошлой недели</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg(stat.color)}`}>
                <stat.icon className={`w-6 h-6 ${iconColor(stat.color)}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Projects */}
        <div className="lg:col-span-2">
          <div className={`${cardBase} p-6 transition-all duration-300 animate-slide-in`} style={{ animationDelay: '600ms' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Активные проекты</h2>
              <button className="text-sm text-slate-400 hover:text-white px-3 py-1 rounded-full hover:bg-white/10 transition-all duration-300">
                Все проекты
              </button>
            </div>
            
            <div className="space-y-4">
              {recentProjects.map((project) => (
                <ProjectCard key={project.id} project={project} compact />
              ))}
            </div>
          </div>
        </div>

        {/* KPI Overview */}
        <div>
          <div className={`${cardBase} p-6 mb-4 animate-slide-in`} style={{ animationDelay: '750ms' }}>
            <h2 className="text-lg font-semibold text-white mb-4">KPI</h2>
            <KPIChart />
          </div>

          {/* Quick Actions */}
          <div className={`${cardBase} p-6 animate-slide-in`} style={{ animationDelay: '900ms' }}>
            <h2 className="text-lg font-semibold text-white mb-4">Быстрые действия</h2>
            <div className="space-y-3">
              {getQuickActions(userRole, onNavigate).map((action, index) => {
                const IconComponent = action.icon;
                const darkIconClass = action.iconColor.replace(/600|700/g, '200').replace('900', '300');
                return (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 group"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 group-hover:opacity-90">
                      <IconComponent className={`w-4 h-4 ${darkIconClass}`} />
                    </div>
                    <span className="font-medium text-sm text-slate-200">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className={`${cardBase} p-6 animate-slide-in`} style={{ animationDelay: '1050ms' }}>
        <h2 className="text-lg font-semibold text-white mb-6">Последние обновления</h2>
        {loadingActivities ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start space-x-3 animate-pulse">
                <div className="w-10 h-10 bg-white/10 rounded-xl"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-3/4"></div>
                  <div className="h-3 bg-white/5 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => {
              const IconComponent = {
                'CheckSquare': CheckSquare,
                'AlertCircle': AlertCircle,
                'CheckCircle': CheckCircle,
                'BarChart3': BarChart3,
                'FileText': FileText
              }[activity.iconName] || FileText;

              const iconBgClass =
                activity.type === 'task' ? 'bg-blue-500/20' :
                activity.type === 'defect' && activity.color === 'bg-red-500' ? 'bg-red-500/20' :
                activity.type === 'defect' && activity.color === 'bg-green-500' ? 'bg-emerald-500/20' :
                activity.type === 'progress' ? 'bg-emerald-500/20' :
                activity.type === 'report' ? 'bg-purple-500/20' :
                'bg-slate-500/20';

              const iconColorClass =
                activity.type === 'task' ? 'text-blue-200' :
                activity.type === 'defect' && activity.color === 'bg-red-500' ? 'text-red-200' :
                activity.type === 'defect' && activity.color === 'bg-green-500' ? 'text-emerald-200' :
                activity.type === 'progress' ? 'text-emerald-200' :
                activity.type === 'report' ? 'text-purple-200' :
                'text-slate-300';

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300"
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full ${iconBgClass} flex items-center justify-center`}>
                    <IconComponent className={`w-5 h-5 ${iconColorClass}`} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-tight">
                      {activity.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <p className="text-xs text-slate-500">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 font-medium">Нет последних обновлений</p>
            <p className="text-xs text-slate-500 mt-1">Новые события появятся здесь</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;