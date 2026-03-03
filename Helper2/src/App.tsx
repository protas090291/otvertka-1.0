
import { useState, useEffect } from 'react';
import Login from './components/Login';
import ModuleSelector from './components/ModuleSelector';
import WorkersApp from './components/WorkersApp';
import ManagementApp from './ManagementApp';
import AdminApp from './components/AdminApp';
import { UserProfile, getCurrentUser, getAvailableModules } from './lib/authApi';

type AppView = 'login' | 'module-selector' | 'workers' | 'management' | 'admin';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setLoading(true);
    
    // Сначала очищаем localStorage от старых данных
    const hasAuth = localStorage.getItem('sb-yytqmdanfcwfqfqruvta-auth-token');
    if (!hasAuth) {
      localStorage.removeItem('lastSelectedModule');
    }
    
    try {
      const { user, error } = await getCurrentUser();
      
      console.log('checkAuth result:', { user: user?.email, error });
      
      if (error || !user) {
        // Пользователь не авторизован - очищаем всё и показываем логин
        console.log('User not authenticated, showing login');
        localStorage.removeItem('lastSelectedModule');
        setCurrentView('login');
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      
      console.log('App checkAuth: Пользователь загружен:', {
        email: user.email,
        role: user.role,
        full_name: user.full_name
      });

      // Проверяем сохранённый последний модуль
      const lastModule = localStorage.getItem('lastSelectedModule') as AppView | null;
      const availableModules = getAvailableModules(user);

      console.log('App checkAuth: Доступные модули:', availableModules, 'Роль пользователя:', user.role, 'Последний модуль:', lastModule);

      // Если есть сохранённый модуль и он доступен - открываем его
      if (lastModule && availableModules.includes(lastModule)) {
        setCurrentView(lastModule);
      } else {
        // Иначе показываем экран выбора модулей
        setCurrentView('module-selector');
      }
    } catch (err) {
      // При любой ошибке показываем логин
      console.error('Ошибка проверки авторизации:', err);
      localStorage.removeItem('lastSelectedModule');
      setCurrentView('login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    const availableModules = getAvailableModules(user);
    
    // Если у пользователя доступен только один модуль - открываем его сразу
    if (availableModules.length === 1) {
      const module = availableModules[0] as AppView;
      localStorage.setItem('lastSelectedModule', module);
      setCurrentView(module);
    } else {
      // Иначе показываем экран выбора модулей
      setCurrentView('module-selector');
    }
  };

  const handleSelectModule = (module: 'workers' | 'management' | 'admin') => {
    localStorage.setItem('lastSelectedModule', module);
    setCurrentView(module);
  };

  const handleExitToModuleSelector = () => {
    setCurrentView('module-selector');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Если нет пользователя - всегда показываем логин
  if (!currentUser && currentView !== 'login') {
    console.log('No user, forcing login view');
    return <Login onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'login':
        return <Login onLogin={handleLogin} />;
      
      case 'module-selector':
        if (!currentUser) {
          return <Login onLogin={handleLogin} />;
        }
        return <ModuleSelector onSelectModule={handleSelectModule} />;
      
      case 'workers':
        if (!currentUser) {
          return <Login onLogin={handleLogin} />;
        }
        return <WorkersApp onExit={handleExitToModuleSelector} />;
      
      case 'management':
        if (!currentUser) {
          return <Login onLogin={handleLogin} />;
        }
        return <ManagementApp onLogout={handleExitToModuleSelector} />;
      
      case 'admin':
        if (!currentUser) {
          return <Login onLogin={handleLogin} />;
        }
        return <AdminApp onExit={handleExitToModuleSelector} />;
      
      default:
        return <Login onLogin={handleLogin} />;
    }
  };

  return (
    <>
      {renderView()}
    </>
  );
}

export default App;