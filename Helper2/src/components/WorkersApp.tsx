import React, { useState, useEffect } from 'react';
import ManagementHeader from './management/ManagementHeader';
import DarkAppNav from './management/DarkAppNav';
import { menuItems } from './Sidebar';
import Dashboard from './Dashboard';
import ProjectsViewWithAPI from './ProjectsViewWithAPI';
import ArchitecturalPlansView from './ArchitecturalPlansView';
import ScheduleViewWithAPI from './ScheduleViewWithAPI';
import BudgetViewWithAPI from './BudgetViewWithAPI';
import MaterialsViewWithAPI from './MaterialsViewWithAPI';
import DefectsView from './DefectsView';
import ReportsViewWithAPI from './ReportsViewWithAPI';
import WorkJournal from './WorkJournal';
import AIAssistant from './AIAssistant';
import YandexDiskView from './YandexDiskView';
import SystemStatusView from './SystemStatusView';
import EstimateView from './EstimateView';
import { UserRole } from '../types';
import { getCurrentUser, signOut, UserProfile } from '../lib/authApi';

interface WorkersAppProps {
  onExit: () => void;
}

const WorkersApp: React.FC<WorkersAppProps> = ({ onExit }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('technadzor');
  const [estimateProjectId, setEstimateProjectId] = useState<string>('');
  const [estimateProjectName, setEstimateProjectName] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { user, error } = await getCurrentUser();
    if (error || !user) {
      // Если пользователь не авторизован - перенаправляем на логин
      window.location.reload();
      return;
    }
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    // Если пользователь - обычный рабочий (user), делаем полный logout
    // Если руководство/админ - возвращаемся к выбору модулей
    if (currentUser?.role === 'user') {
      const { error } = await signOut();
      if (error) {
        console.error('Ошибка выхода:', error);
        alert('Ошибка выхода из системы');
      } else {
        window.location.reload();
      }
    } else {
      // Для руководства/админа - возврат к выбору модулей
      onExit();
    }
  };

  const renderContent = () => {
    try {
      switch (currentView) {
        case 'dashboard':
          return <Dashboard userRole={userRole} onNavigate={setCurrentView} />;
        case 'projects':
          return (
            <ProjectsViewWithAPI
              userRole={userRole}
              onNavigateToPlans={() => setCurrentView('architectural-plans')}
              onNavigateToEstimate={(projectId, projectName) => {
                setEstimateProjectId(projectId);
                setEstimateProjectName(projectName);
                setCurrentView('estimate');
              }}
            />
          );
        case 'estimate':
          return (
            <EstimateView
              projectId={estimateProjectId}
              projectName={estimateProjectName}
              onNavigateBack={() => setCurrentView('projects')}
            />
          );
        case 'architectural-plans':
          return <ArchitecturalPlansView userRole={userRole} onNavigateBack={() => setCurrentView('projects')} />;
        case 'schedule':
          return <ScheduleViewWithAPI userRole={userRole} />;
        case 'budget':
          return <BudgetViewWithAPI userRole={userRole} />;
        case 'materials':
          return <MaterialsViewWithAPI userRole={userRole} />;
        case 'defects':
          return <DefectsView userRole={userRole} />;
        case 'work-journal':
          return <WorkJournal userRole={userRole} />;
        case 'reports':
          return <ReportsViewWithAPI userRole={userRole} />;
        case 'yandex-disk':
          return <YandexDiskView userRole={userRole} />;
        default:
          return <Dashboard userRole={userRole} onNavigate={setCurrentView} />;
      }
    } catch (error) {
      console.error('Error rendering content:', error);
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white">Ошибка загрузки</h1>
          <p className="text-slate-300">Пожалуйста, обновите страницу</p>
        </div>
      );
    }
  };

  const navItems = menuItems[userRole].map(({ id, label }) => ({ id, label }));
  const navHighlightView = ['estimate', 'architectural-plans'].includes(currentView) ? 'projects' : currentView;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-blue-400/20 blur-[120px]" />
        <div className="absolute top-40 right-0 h-72 w-72 rounded-full bg-purple-500/10 blur-[140px]" />
      </div>
      <div className="relative z-10">
        <ManagementHeader badge="РАБОЧИЙ МОДУЛЬ" onLogout={handleLogout} currentUserId={currentUser?.id || null} />
        <DarkAppNav
          items={navItems}
          currentView={navHighlightView}
          onViewChange={setCurrentView}
        />
        <main className="pt-24">
          <div className="mx-auto max-w-7xl space-y-8 px-6 pb-12">
            <div className="rounded-3xl border border-white/5 bg-slate-900/60 bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-6 shadow-2xl shadow-black/20 min-h-[60vh]">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>
      <AIAssistant userRole={userRole} />
    </div>
  );
};

export default WorkersApp;
