import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  Keyboard,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { WorstCaseBanner } from '@/components/shared/WorstCaseBanner';
import { KeyboardCheatsheetModal } from '@/components/shared/KeyboardCheatsheetModal';
import { posAudio } from '@/lib/audio-feedback';

export type AppModuleKey =
  | 'pos'
  | 'medicines'
  | 'invoices'
  | 'stock-cards'
  | 'pareto-defekta'
  | 'users-sipa';

export interface NavItemConfig {
  key: AppModuleKey;
  label: string;
  path: string;
  aliases: string[];
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  allowedRoles: Array<'OWNER' | 'PHARMACIST' | 'CASHIER'>;
}

export const APP_NAV_ITEMS: NavItemConfig[] = [
  {
    key: 'pos',
    label: 'Kasir',
    path: '/pos',
    aliases: ['/', '/pos', '/cashier', '/sales'],
    icon: ShoppingCart,
    allowedRoles: ['OWNER', 'PHARMACIST', 'CASHIER'],
  },
  {
    key: 'medicines',
    label: 'Obat',
    path: '/medicines',
    aliases: ['/medicines', '/catalog'],
    icon: Package,
    allowedRoles: ['OWNER', 'PHARMACIST', 'CASHIER'],
  },
  {
    key: 'invoices',
    label: 'Faktur masuk',
    path: '/invoices',
    aliases: ['/invoices', '/pbf-invoices'],
    icon: FileSpreadsheet,
    allowedRoles: ['OWNER', 'PHARMACIST'],
  },
  {
    key: 'stock-cards',
    label: 'Kartu stok',
    path: '/stock-cards',
    aliases: ['/stock-cards', '/inventory', '/batches'],
    icon: ClipboardList,
    allowedRoles: ['OWNER', 'PHARMACIST', 'CASHIER'],
  },
  {
    key: 'pareto-defekta',
    label: 'Analitik',
    path: '/pareto-defekta',
    aliases: ['/pareto-defekta', '/pareto', '/defekta', '/procurement'],
    icon: BarChart3,
    allowedRoles: ['OWNER', 'PHARMACIST'],
  },
  {
    key: 'users-sipa',
    label: 'Pengguna',
    path: '/users',
    aliases: ['/users', '/users-sipa', '/sipa'],
    icon: Users,
    allowedRoles: ['OWNER'],
  },
];

export function navigateTo(targetPath: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const currentUrl = new URL(window.location.href);
  const nextUrl = new URL(targetPath, window.location.origin);

  const worstParam = currentUrl.searchParams.get('data');
  if (worstParam && !nextUrl.searchParams.has('data')) {
    nextUrl.searchParams.set('data', worstParam);
  }

  const fullDestination = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  if (`${window.location.pathname}${window.location.search}` !== fullDestination) {
    window.history.pushState({}, '', fullDestination);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export interface AppShellProps {
  children?: React.ReactNode;
  activePath?: string;
  activeModule?: AppModuleKey | string;
  onNavigate?: (path: string, moduleKey: AppModuleKey) => void;
  pageTitle?: string;
  pageDescription?: string;
  headerActions?: React.ReactNode;
}

export function AppShell({
  children,
  activePath,
  activeModule,
  onNavigate,
  pageTitle,
  pageDescription,
  headerActions,
}: AppShellProps) {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [currentPathname, setCurrentPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/pos',
  );
  const [isKeyboardModalOpen, setIsKeyboardModalOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => posAudio.getIsMuted());

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (!isInput && e.key === '?') {
        e.preventDefault();
        setIsKeyboardModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  const handleToggleMute = () => {
    const muted = posAudio.toggleMute();
    setIsMuted(muted);
    toast.info(muted ? 'Suara kasir dibisukan' : 'Suara kasir diaktifkan');
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const resolvedPath = activePath ?? currentPathname;

  const isNavItemActive = (item: NavItemConfig): boolean => {
    if (activeModule) {
      return activeModule === item.key || item.aliases.includes(String(activeModule));
    }
    return item.aliases.some(
      (alias) =>
        resolvedPath === alias || (alias !== '/' && resolvedPath.startsWith(`${alias}/`)),
    );
  };

  const handleSelectNav = (item: NavItemConfig) => {
    if (onNavigate) {
      onNavigate(item.path, item.key);
    }
    navigateTo(item.path);
    setCurrentPathname(item.path);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Tetap bersihkan sesi lokal
    } finally {
      clearSession();
      toast.success('Sesi kerja selesai');
      navigateTo('/login');
    }
  };

  const userRole = user?.role ?? 'CASHIER';
  const visibleNavItems = APP_NAV_ITEMS.filter((item) => item.allowedRoles.includes(userRole));

  const isPosPage = resolvedPath.startsWith('/pos') || resolvedPath === '/';

  // Inisial nama pengguna
  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'RH';

  return (
    <div className="flex min-h-screen w-full bg-canvas text-ink">
      {/* Sidebar Putih (248px), garis kanan border-line */}
      <aside
        aria-label="Navigasi apotek"
        className="flex w-[248px] shrink-0 flex-col justify-between border-r border-line bg-surface text-ink"
      >
        <div className="p-4">
          {/* Logo RHS: Kotak mint rounded 10px berisi glif Asklepios berwarna ink */}
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-mint text-ink border border-line-input">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-ink truncate">
                Raddina Health
              </div>
              <div className="text-xs text-ink-muted truncate">
                Apotek &amp; kasir FEFO
              </div>
            </div>
          </div>

          {/* Navigasi Menu Sesuai Hak Akses Peran */}
          <nav className="mt-4 space-y-1" aria-label="Menu utama">
            {visibleNavItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = isNavItemActive(item);

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectNav(item)}
                  className={`pos-instant flex h-11 w-full items-center gap-3 rounded-control px-3 text-left text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-mint text-ink border border-line-input'
                      : 'text-ink-soft hover:bg-hover hover:text-ink'
                  }`}
                >
                  <IconComponent className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Menu Pengguna di Dasar Sidebar */}
        <div className="border-t border-line p-4 space-y-3">
          {/* Info Akun & SIPA */}
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage text-ink font-semibold text-xs border border-line-input">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink truncate leading-tight">
                    {user.fullName}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusBadge kind="role" role={user.role} compact />
                  </div>
                </div>
              </div>

              {/* Status SIPA khusus Apoteker */}
              {user.role === 'PHARMACIST' && (
                <div className="pt-1">
                  <StatusBadge
                    kind="sipa"
                    isSipaActive={user.isSipaActive}
                    sipaExpiryDate={user.sipaExpiryDate}
                    role={user.role}
                    compact
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-ink-muted">Belum masuk</div>
          )}

          {/* Baris Tombol Aksi: Suara, Pintasan, Keluar */}
          <div className="flex items-center justify-between pt-1 border-t border-line">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleMute}
                className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-hover hover:text-ink"
                title={isMuted ? 'Aktifkan suara' : 'Bisukan suara'}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsKeyboardModalOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-hover hover:text-ink"
                title="Panduan tombol (?)"
              >
                <Keyboard className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-control px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger-soft"
                title="Keluar sesi"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Konten Utama (Tanpa Topbar, Judul Halaman Masuk ke Dalam Konten) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Banner Mode Uji Ekstrem */}
        <div className="px-6 pt-3 empty:hidden">
          <WorstCaseBanner />
        </div>

        {/* Wadah Halaman */}
        <div
          className={`flex-1 p-6 lg:p-8 ${
            isPosPage ? 'w-full' : 'mx-auto w-full max-w-[1280px]'
          }`}
        >
          {/* Kepala Halaman: Judul Halaman dan Aksi Utama */}
          {(pageTitle || headerActions) && (
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {pageTitle && (
                  <h1 className="text-2xl font-semibold tracking-tight text-ink">
                    {pageTitle}
                  </h1>
                )}
                {pageDescription && (
                  <p className="mt-1 text-sm text-ink-muted max-w-[72ch]">
                    {pageDescription}
                  </p>
                )}
              </div>
              {headerActions && (
                <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                  {headerActions}
                </div>
              )}
            </div>
          )}

          {/* Konten Halaman */}
          <main>{children}</main>
        </div>

        {/* Modal Panduan Pintasan Papan Ketik */}
        <KeyboardCheatsheetModal
          isOpen={isKeyboardModalOpen}
          onClose={() => setIsKeyboardModalOpen(false)}
        />
      </div>
    </div>
  );
}

export default AppShell;
