import { useState, useEffect } from 'react';
import ManagementHeader from './components/management/ManagementHeader';
import { getCurrentUser, UserProfile } from './lib/authApi';
import ManagementNav from './components/management/ManagementNav';
import SummaryView from './components/management/SummaryView';
import AccountingView from './components/management/AccountingView';
import ProjectDetailView from './components/management/ProjectDetailView';
import ContractsView from './components/management/ContractsView';
import PurchasesView from './components/management/PurchasesView';
import RDCDView from './components/management/RDCDView';
import ControlSystemView from './components/management/ControlSystemView';

interface ManagementAppProps {
  onLogout: () => void; // Теперь это возврат к выбору модулей, а не полный logout
}

function ManagementApp({ onLogout }: ManagementAppProps) {
  const [currentView, setCurrentView] = useState('summary');
  const [accountingSubView, setAccountingSubView] = useState<'balance' | 'cashflow' | 'pl'>('balance');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { user } = await getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    };
    loadUser();
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case 'summary':
        return <SummaryView />;
      case 'accounting':
        return <AccountingView subView={accountingSubView} onSubViewChange={setAccountingSubView} />;
      case 'projects':
        return <ProjectDetailView />;
      case 'contracts':
        return <ContractsView />;
      case 'purchases':
        return <PurchasesView />;
      case 'rdcd':
        return <RDCDView />;
      case 'control':
        return <ControlSystemView />;
      default:
        return <SummaryView />;
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-blue-400/20 blur-[120px]" />
        <div className="absolute top-40 right-0 h-72 w-72 rounded-full bg-purple-500/10 blur-[140px]" />
      </div>
      <div className="relative z-10">
        <ManagementHeader onLogout={onLogout} currentUserId={currentUser?.id || null} />
        <ManagementNav
          currentView={currentView}
          onViewChange={setCurrentView}
          accountingSubView={accountingSubView}
          onAccountingSubViewChange={setAccountingSubView}
        />
        <main className="pt-24">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default ManagementApp;


