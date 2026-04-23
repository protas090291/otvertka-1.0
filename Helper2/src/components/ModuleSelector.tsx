import React, { useEffect, useState } from 'react';
import { Building2, Users, Settings, LogOut, Loader2 } from 'lucide-react';
import { UserProfile, signOut, getCurrentUser } from '../lib/authApi';

interface ModuleSelectorProps {
  onSelectModule: (module: 'workers' | 'management' | 'admin') => void;
}

const ModuleSelector: React.FC<ModuleSelectorProps> = ({ onSelectModule }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    setLoading(true);
    const { user: currentUser, error } = await getCurrentUser();
    if (error || !currentUser) {
      console.error('Ошибка загрузки пользователя:', error);
      // Если не удалось загрузить пользователя, перенаправляем на логин
      window.location.reload();
      return;
    }

    console.log('ModuleSelector: Загружен пользователь:', {
      email: currentUser.email,
      role: currentUser.role,
      full_name: currentUser.full_name
    });

    setUser(currentUser);
    setLoading(false);
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Ошибка выхода:', error);
      alert('Ошибка выхода из системы');
    } else {
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-white/70">Загрузка...</p>
        </div>
      </div>
    );
  }

  const modules = [
    {
      id: 'workers' as const,
      title: 'Рабочий состав',
      description: 'Система для рабочих и исполнителей',
      icon: Building2,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    {
      id: 'management' as const,
      title: 'Руководство',
      description: 'Система управления проектами',
      icon: Users,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    },
    {
      id: 'admin' as const,
      title: 'Администрирование',
      description: 'Управление пользователями и системой',
      icon: Settings,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
    },
  ];

  // Показываем все модули независимо от роли пользователя.
  const visibleModules = modules;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Отвёртка</h1>
            <p className="text-blue-200">
              Добро пожаловать, {user?.full_name || user?.email || 'Пользователь'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20"
          >
            <LogOut className="h-4 w-4" />
            Выйти из аккаунта
          </button>
        </header>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleModules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                onClick={() => onSelectModule(module.id)}
                className={`group relative overflow-hidden rounded-2xl border-2 ${module.borderColor} ${module.bgColor} p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-${module.color.split(' ')[0]}/20`}
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                
                {/* Content */}
                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${module.color} mb-4 shadow-lg`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{module.title}</h2>
                  <p className="text-blue-200/70">{module.description}</p>
                </div>

                {/* Arrow indicator */}
                <div className="absolute bottom-4 right-4 text-white/50 group-hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>

        {/* Info */}
        <div className="mt-8 text-center text-sm text-blue-200/50">
          Выберите модуль для работы
        </div>
      </div>
    </div>
  );
};

export default ModuleSelector;
