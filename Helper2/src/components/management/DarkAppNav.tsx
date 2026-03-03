import React from 'react';

export interface DarkAppNavItem {
  id: string;
  label: string;
}

interface DarkAppNavProps {
  items: DarkAppNavItem[];
  currentView: string;
  onViewChange: (view: string) => void;
}

/** Горизонтальная навигация в стиле модуля руководства (тёмная тема). */
const DarkAppNav: React.FC<DarkAppNavProps> = ({ items, currentView, onViewChange }) => {
  return (
    <nav className="fixed top-16 left-0 right-0 z-40 border-b border-white/5 bg-slate-900/70 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <div className="flex flex-1 items-center space-x-1 overflow-x-auto py-2">
          {items.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={[
                  'whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-white/10 text-white shadow-[0_10px_30px_rgba(15,23,42,0.35)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/5',
                ].join(' ')}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default DarkAppNav;
