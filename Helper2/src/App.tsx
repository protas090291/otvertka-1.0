
import { useState, useEffect } from 'react';
import Login from './components/Login';
import ModuleSelector from './components/ModuleSelector';
import WorkersApp from './components/WorkersApp';
import ManagementApp from './ManagementApp';
import AdminApp from './components/AdminApp';
import { UserProfile, getCurrentUser } from './lib/authApi';

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

      // По запросу: всегда показываем экран выбора модуля после авторизации.
      localStorage.removeItem('lastSelectedModule');
      setCurrentView('module-selector');
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
    // Всегда показываем экран выбора модуля.
    localStorage.removeItem('lastSelectedModule');
    setCurrentView('module-selector');
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