import React from 'react';
import {
  Home,
  Building2,
  Calendar,
  DollarSign,
  Package,
  FileText,
  BarChart3,
  Users,
  AlertTriangle,
  FileImage,
  BookOpen,
  Cloud
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  userRole: UserRole;
  isOpen: boolean;
}

export const menuItems = {
  client: [
    { id: 'dashboard', label: 'Сводка', icon: Home },
    { id: 'projects', label: 'Проекты', icon: Building2 },
    { id: 'schedule', label: 'График', icon: Calendar },
    { id: 'budget', label: 'Бюджет', icon: DollarSign },
    { id: 'defects', label: 'Дефекты', icon: AlertTriangle },
    { id: 'work-journal', label: 'Журнал работ', icon: BookOpen },
    { id: 'reports', label: 'Отчёты', icon: FileText },
    { id: 'yandex-disk', label: 'Яндекс Диск', icon: Cloud },
  ],
  foreman: [
    { id: 'dashboard', label: 'Сводка', icon: Home },
    { id: 'projects', label: 'Проекты', icon: Building2 },
    { id: 'schedule', label: 'График', icon: Calendar },
    { id: 'materials', label: 'Материалы', icon: Package },
    { id: 'defects', label: 'Дефекты', icon: AlertTriangle },
    { id: 'work-journal', label: 'Журнал работ', icon: BookOpen },
    { id: 'reports', label: 'Отчёты', icon: FileText },
    { id: 'yandex-disk', label: 'Яндекс Диск', icon: Cloud },
  ],
  contractor: [
    { id: 'dashboard', label: 'Сводка', icon: Home },
    { id: 'projects', label: 'Проекты', icon: Building2 },
    { id: 'schedule', label: 'График', icon: Calendar },
    { id: 'budget', label: 'Бюджет', icon: DollarSign },
    { id: 'materials', label: 'Материалы', icon: Package },
    { id: 'defects', label: 'Дефекты', icon: AlertTriangle },
    { id: 'work-journal', label: 'Журнал работ', icon: BookOpen },
    { id: 'reports', label: 'Отчёты', icon: FileText },
    { id: 'yandex-disk', label: 'Яндекс Диск', icon: Cloud },
  ],
  worker: [
    { id: 'dashboard', label: 'Сводка', icon: Home },
    { id: 'schedule', label: 'Задачи', icon: Calendar },
    { id: 'materials', label: 'Материалы', icon: Package },
    { id: 'defects', label: 'Дефекты', icon: AlertTriangle },
    { id: 'work-journal', label: 'Журнал работ', icon: BookOpen },
    { id: 'reports', label: 'Отчёты', icon: FileText },
    { id: 'yandex-disk', label: 'Яндекс Диск', icon: Cloud },
  ],
  storekeeper: [
    { id: 'dashboard', label: 'Сводка', icon: Home },
    { id: 'projects', label: 'Проекты', icon: Building2 },
    { id: 'materials', label: 'Материалы', icon: Package },
    { id: 'reports', label: 'Отчёты', icon: FileText },
    { id: 'yandex-disk', label: 'Яндекс Диск', icon: Cloud },
  ],
  technadzor: [
    { id: 'dashboard', label: 'Сводка', icon: Home },
    { id: 'projects', label: 'Проекты', icon: Building2 },
    { id: 'schedule', label: 'Задачи', icon: Calendar },
    { id: 'defects', label: 'Дефекты', icon: AlertTriangle },
    { id: 'work-journal', label: 'Журнал работ', icon: BookOpen },
    { id: 'reports', label: 'Отчёты', icon: FileText },
    { id: 'yandex-disk', label: 'Яндекс Диск', icon: Cloud },
  ]
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, userRole, isOpen }) => {
  const items = menuItems[userRole];

  return (
    <aside className={`fixed left-6 top-20 transition-all duration-500 ${
      isOpen ? 'w-64' : 'w-16'
    } z-40`}>
      <nav className="p-2">
        <ul className="space-y-4">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={`flex items-center space-x-3 px-3 py-3 rounded-full transition-all duration-300 group ${
                    isActive
                      ? 'bg-white/90 shadow-lg backdrop-blur-sm'
                      : 'hover:bg-white/70 hover:shadow-md backdrop-blur-sm'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-md' 
                      : 'bg-white/80 group-hover:bg-white shadow-sm'
                  }`}>
                    <Icon className={`w-5 h-5 transition-colors duration-300 ${
                      isActive ? 'text-white' : 'text-slate-600 group-hover:text-gray-900'
                    }`} />
                  </div>
                  {isOpen && (
                    <span className={`font-medium transition-colors duration-300 ${
                      isActive ? 'text-gray-900' : 'text-gray-700 group-hover:text-gray-900'
                    }`}>
                      {item.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;