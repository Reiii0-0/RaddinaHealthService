import React, { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { AppShell, AppModuleKey } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { MedicinesPage } from '@/pages/MedicinesPage';
import { PbfInvoicesPage } from '@/pages/PbfInvoicesPage';
import { StockCardsPage } from '@/pages/StockCardsPage';
import { PosCashierPage } from '@/pages/PosCashierPage';
import { ParetoDefektaPage } from '@/pages/ParetoDefektaPage';
import { UsersSipaPage } from '@/pages/UsersSipaPage';

function resolveModuleFromPath(pathname: string): AppModuleKey {
  if (pathname === '/pos' || pathname === '/cashier' || pathname === '/sales') {
    return 'pos';
  }
  if (pathname === '/medicines' || pathname === '/catalog') {
    return 'medicines';
  }
  if (pathname === '/invoices' || pathname === '/pbf-invoices') {
    return 'invoices';
  }
  if (pathname === '/stock-cards' || pathname === '/inventory' || pathname === '/batches') {
    return 'stock-cards';
  }
  if (pathname === '/pareto-defekta' || pathname === '/pareto' || pathname === '/defekta') {
    return 'pareto-defekta';
  }
  if (pathname === '/users' || pathname === '/users-sipa' || pathname === '/sipa') {
    return 'users-sipa';
  }
  return 'pos';
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = Boolean(user);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [currentModule, setCurrentModule] = useState<AppModuleKey>(() =>
    typeof window !== 'undefined' ? resolveModuleFromPath(window.location.pathname) : 'pos',
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentModule(resolveModuleFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <>
      <Toaster position="bottom-right" richColors closeButton />

      {!isAuthenticated ? (
        authView === 'login' ? (
          <LoginPage onNavigateToRegister={() => setAuthView('register')} />
        ) : (
          <RegisterPage onNavigateToLogin={() => setAuthView('login')} />
        )
      ) : (
        <AppShell
          activeModule={currentModule}
          onNavigate={(_path, key) => setCurrentModule(key)}
        >
          {currentModule === 'pos' && <PosCashierPage />}
          {currentModule === 'medicines' && <MedicinesPage />}
          {currentModule === 'invoices' && <PbfInvoicesPage />}
          {currentModule === 'stock-cards' && <StockCardsPage />}
          {currentModule === 'pareto-defekta' && <ParetoDefektaPage />}
          {currentModule === 'users-sipa' && <UsersSipaPage />}
        </AppShell>
      )}
    </>
  );
}
