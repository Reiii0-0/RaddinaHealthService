import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { Asclepius3DExperience } from '@/components/shared/Asclepius3DExperience';

interface RegisterPageProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess?: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onNavigateToLogin,
  onRegisterSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setSession } = useAuthStore();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password) {
      toast.error('Seluruh kolom wajib diisi.');
      return;
    }

    if (password.length < 8) {
      toast.error('Kata sandi minimal 8 karakter.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });

      if ('accessToken' in response && response.accessToken) {
        setSession(response as any);
      }
      toast.success('Pendaftaran akun berhasil. Selamat datang di RHS.');

      if (onRegisterSuccess) {
        onRegisterSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Email ini sudah terdaftar. Masuk atau gunakan email lain.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {/* Kolom Kiri: Formulir Pendaftaran */}
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
              Daftar akun
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Akun baru berperan Kasir. Pemilik apotek dapat mengubah peran bila diperlukan.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="reg-name"
                className="block text-xs font-medium text-ink"
              >
                Nama lengkap
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama staf apotek"
                className="mt-1 h-12 w-full rounded-control border border-line-input bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="reg-email"
                className="block text-xs font-medium text-ink"
              >
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@raddina.id"
                className="mt-1 h-12 w-full rounded-control border border-line-input bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="reg-password"
                className="block text-xs font-medium text-ink"
              >
                Kata sandi
              </label>
              <div className="relative mt-1">
                <input
                  id="reg-password"
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
              {isLoading ? 'Mendaftarkan akun...' : 'Daftar sekarang'}
            </button>
          </form>

          {/* Tautan Kembali ke Masuk */}
          <div className="mt-6 text-center text-xs text-ink-muted">
            Sudah memiliki akun?{' '}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="font-semibold text-action hover:underline"
            >
              Masuk
            </button>
          </div>
        </div>

        <div className="mx-auto mt-8 w-full max-w-[400px] text-center text-[11px] text-ink-muted font-mono">
          Raddina Health Service v2.0
        </div>
      </div>

      {/* Kolom Kanan: Panggung 3D Asklepios berlatar Mint */}
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

export default RegisterPage;
