import React from 'react';

interface ManagementNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
  accountingSubView: 'balance' | 'cashflow' | 'pl';
  onAccountingSubViewChange: (view: 'balance' | 'cashflow' | 'pl') => void;
}

const ManagementNav: React.FC<ManagementNavProps> = ({
  currentView,
  onViewChange,
  accountingSubView,
  onAccountingSubViewChange,
}) => {
  const navItems = [
    { id: 'summary', label: 'Summary' },
    { id: 'accounting', label: 'Бух. отчетность' },
    { id: 'projects', label: 'Проекты' },
    { id: 'contracts', label: 'Договоры' },
    { id: 'purchases', label: 'Закупки' },
    { id: 'rdcd', label: 'РД и СД' },
    { id: 'control', label: 'Система контроля' },
  ];

  return (
    <nav className="fixed top-16 left-0 right-0 z-40 border-b border-white/5 bg-slate-900/70 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <div className="flex flex-1 items-center space-x-1 overflow-x-auto py-2">
          {navItems.map((item) => {
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

      {currentView === 'accounting' && (
        <div className="border-t border-white/5 bg-slate-900/80">
          <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 px-6 py-3">
            {(['balance', 'cashflow', 'pl'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onAccountingSubViewChange(mode)}
                className={[
                  'rounded-full px-4 py-1.5 text-sm font-medium capitalize transition',
                  accountingSubView === mode
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-900/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/10',
                ].join(' ')}
              >
                {mode === 'balance' ? 'Баланс' : mode === 'cashflow' ? 'Cash Flow' : 'PL'}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default ManagementNav;


