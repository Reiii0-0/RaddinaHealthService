import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { Asclepius3DExperience } from '@/components/shared/Asclepius3DExperience';

interface LoginPageProps {
  onNavigateToRegister?: () => void;
  onLoginSuccess?: () => void;
}

const DEMO_ACCOUNTS = [
  {
    role: 'Pemilik Apotek',
    email: 'owner@raddina.id',
    pass: 'RaddinaOwner123!',
    desc: 'Akses penuh seluruh modul, omzet & hak akses',
  },
  {
    role: 'Apoteker (SIPA Aktif)',
    email: 'apt.rina@raddina.id',
    pass: 'RaddinaApt123!',
    desc: 'Verifikasi faktur PBF & penerbitan SP-el sah',
  },
  {
    role: 'Apoteker (SIPA Kedaluwarsa)',
    email: 'apt.expired@raddina.id',
    pass: 'RaddinaExp123!',
    desc: 'Uji penolakan SP-el 403 oleh penjaga SIPA',
  },
  {
    role: 'Kasir Operasional',
    email: 'kasir.budi@raddina.id',
    pass: 'RaddinaKasir123!',
    desc: 'Kasir cepat POS FEFO & tombol pintas keyboard',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigateToRegister,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setSession } = useAuthStore();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      toast.error('Email dan kata sandi wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.login({ email, password });
      setSession(response);
      toast.success(`Selamat datang, ${response.user.fullName}`);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      toast.error('Email atau kata sandi tidak cocok. Periksa lagi lalu coba masuk.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {/* Kolom Kiri: Formulir Masuk (Lebar maksimal 400px di dalam area kerja) */}
      <div className="flex flex-1 flex-col justify-between p-6 sm:p-12 lg:p-16">
        <div className="mx-auto w-full max-w-[400px]">
          {/* Logo RHS */}
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-control bg-mint text-ink font-bold font-mono text-lg shadow-2xs">
              ⚕
            </div>
            <div>
              <div className="text-base font-bold text-ink">
                Raddina Health Service
              </div>
              <div className="text-xs text-ink-muted">
                Sistem informasi dan kasir apotek
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Masuk
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Masukkan kredensial akun staf untuk mengakses apotek
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-medium text-ink"
              >
                Email
              </label>
              <div className="relative mt-1">
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@raddina.id"
                  className="h-12 w-full rounded-control border border-line-input bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-ink"
              >
                Kata sandi
              </label>
              <div className="relative mt-1">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="h-12 w-full rounded-control border border-line-input bg-surface pr-10 pl-3.5 text-sm text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex h-12 w-full items-center justify-center rounded-control bg-action text-sm font-semibold text-white shadow-xs transition-colors hover:bg-action-hover active:bg-action-press disabled:opacity-50"
            >
              {isLoading ? 'Memeriksa kredensial...' : 'Masuk'}
            </button>
          </form>

          {/* Tautan Daftar */}
          <div className="mt-6 text-center text-xs text-ink-muted">
            Belum punya akun?{' '}
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="font-semibold text-action hover:underline"
            >
              Daftar
            </button>
          </div>

          {/* Akun Demo (Hanya Muncul di Mode Pengembangan sesuai DESIGN.md Section 8.1) */}
          {import.meta.env.DEV && (
            <div className="mt-10 rounded-panel border border-line bg-surface p-4 text-xs">
              <div className="font-semibold text-ink">
                Akun demo (mode pengembangan)
              </div>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                Klik salah satu akun untuk mengisi formulir:
              </p>

              <div className="mt-3 space-y-1.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillCredentials(acc.email, acc.pass)}
                    className="flex w-full items-center justify-between rounded-control border border-line bg-canvas p-2 text-left hover:bg-hover active:bg-selected"
                  >
                    <div>
                      <div className="font-semibold text-ink">{acc.role}</div>
                      <div className="font-mono text-[11px] text-ink-muted">
                        {acc.email}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-action">
                      Pilih
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto mt-8 w-full max-w-[400px] text-center text-[11px] text-ink-muted font-mono">
          Raddina Health Service v2.0
        </div>
      </div>

      {/* Kolom Kanan: Panggung 3D Asklepios berlatar Mint (Disembunyikan di layar < 1024px) */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center border-l border-line bg-mint p-12">
        <div className="flex h-full w-full max-w-lg flex-col items-center justify-center space-y-6 text-center">
          <Asclepius3DExperience
            compact={false}
            showControls={true}
            className="h-[460px] w-full"
          />

          <div>
            <div className="font-serif text-lg tracking-wide text-ink italic">
              Salus Aegroti Suprema Lex
            </div>
            <div className="mt-1 text-xs text-ink-soft">
              Kesehatan dan keselamatan pasien adalah hukum tertinggi
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
