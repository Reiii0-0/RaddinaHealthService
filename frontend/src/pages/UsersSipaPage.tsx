import React, { useEffect, useState } from 'react';
import {
  Lock,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AuthUserDto, UserRole } from '@shared/api-contracts';
import { usersApi } from '@/lib/api-client';
import { computeDaysUntilExpiry, formatDateId } from '@/lib/formatters';
import { applyWorstCaseUsers, useWorstCaseMode } from '@/lib/worst-case-fixtures';
import { useAuthStore } from '@/stores/auth.store';
import { StatusBadge } from '@/components/shared/StatusBadge';

export function UsersSipaPage() {
  const currentUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [isWorstCase] = useWorstCaseMode();

  const [users, setUsers] = useState<AuthUserDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Laci Ubah Peran Sesuai DESIGN.md Section 8.7
  const [selectedUser, setSelectedUser] = useState<AuthUserDto | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('CASHIER');
  const [editNoSipa, setEditNoSipa] = useState<string>('');
  const [editSipaExpiry, setEditSipaExpiry] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = currentUser?.role === 'OWNER';

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await usersApi.list();
      setUsers(applyWorstCaseUsers(data));
    } catch {
      toast.error('Tidak dapat terhubung ke server. Periksa koneksi lalu muat ulang.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isWorstCase]);

  const handleOpenEditDrawer = (targetUser: AuthUserDto) => {
    if (!isOwner) {
      toast.error('Peran Anda tidak memiliki akses untuk mengubah peran staf.');
      return;
    }
    setSelectedUser(targetUser);
    setEditRole(targetUser.role);
    setEditNoSipa(targetUser.noSipa || '');
    setEditSipaExpiry(
      targetUser.sipaExpiryDate
        ? targetUser.sipaExpiryDate.slice(0, 10)
        : '',
    );
  };

  const handleCloseEditDrawer = () => {
    setSelectedUser(null);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (editRole === 'PHARMACIST' && !editNoSipa.trim()) {
      toast.error('Nomor SIPA wajib diisi untuk peran Apoteker.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        role: editRole,
        noSipa: editRole === 'PHARMACIST' ? editNoSipa.trim() : null,
        sipaExpiryDate:
          editRole === 'PHARMACIST' && editSipaExpiry ? editSipaExpiry : null,
      };

      const updated = await usersApi.updateRoleSipa(selectedUser.id, payload);
      toast.success(`Peran ${updated.fullName} berhasil diperbarui.`);

      if (currentUser && currentUser.id === updated.id) {
        updateUser(updated);
      }

      handleCloseEditDrawer();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui peran pengguna.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-panel border border-line bg-surface p-8 text-center text-ink">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream text-warn-ink">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-ink">
          Akses khusus Pemilik Apotek
        </h2>
        <p className="mt-1 max-w-md text-xs text-ink-muted">
          Peran Anda ({currentUser?.role}) tidak memiliki izin mengakses modul manajemen pengguna dan SIPA. Hubungi pemilik sarana bila perlu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Kepala Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Pengguna
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Tata kelola staf apotek, hak akses peran, dan verifikasi masa berlaku izin SIPA
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={isLoading}
          className="flex h-10 items-center gap-2 rounded-control border border-line-input bg-surface px-4 text-xs font-semibold text-ink hover:bg-hover active:bg-selected disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-action' : ''}`} />
          <span>Segarkan pengguna</span>
        </button>
      </div>

      {/* Tabel Pengguna Sesuai DESIGN.md Section 8.7 */}
      <div className="rounded-panel border border-line bg-surface overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface text-ink-muted">
              <tr className="h-10 text-[11px] font-semibold">
                <th className="px-4 py-2">Nama staf</th>
                <th className="px-3 py-2 font-mono">Email</th>
                <th className="px-3 py-2">Peran</th>
                <th className="px-3 py-2">Izin SIPA kefarmasian</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-ink-muted">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-action" />
                      <span>Memuat daftar pengguna...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-ink-muted">
                    Belum ada data staf apotek terdaftar.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const daysLeft = u.sipaExpiryDate
                    ? computeDaysUntilExpiry(u.sipaExpiryDate)
                    : null;

                  return (
                    <tr key={u.id} className="h-14 hover:bg-hover transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sage font-mono text-xs font-bold text-ink">
                            {u.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-ink text-sm">
                              {u.fullName}
                            </div>
                            <div className="text-[11px] text-ink-muted">
                              Bergabung {formatDateId(u.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 font-mono text-ink-soft">
                        {u.email}
                      </td>

                      <td className="px-3 py-2.5">
                        {u.role === 'OWNER' ? (
                          <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">
                            Pemilik
                          </span>
                        ) : u.role === 'PHARMACIST' ? (
                          <span className="inline-flex items-center rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-ink border border-line-input">
                            Apoteker
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink border border-line-input">
                            Kasir
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2.5">
                        {u.role === 'PHARMACIST' ? (
                          <div className="space-y-0.5">
                            <div className="font-mono text-xs font-semibold text-ink">
                              {u.noSipa || 'Belum diisi'}
                            </div>
                            <div className="flex items-center gap-2">
                              {u.isSipaActive ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-action">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  <span>Aktif ({daysLeft !== null ? `${daysLeft} hr` : 'sah'})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-danger-ink border border-danger-ink/30">
                                  Kedaluwarsa
                                </span>
                              )}
                              {u.sipaExpiryDate && (
                                <span className="font-mono text-[11px] text-ink-muted">
                                  s/d {formatDateId(u.sipaExpiryDate)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-ink-muted italic">
                            Tidak memerlukan SIPA
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDrawer(u)}
                          className="inline-flex items-center gap-1 rounded-control border border-line-input bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-hover active:bg-selected"
                        >
                          <UserCog className="h-3.5 w-3.5 text-action" />
                          <span>Ubah peran</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Laci Ubah Peran (480px Dari Kanan) Sesuai DESIGN.md Section 8.7 */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-drawer-title"
        >
          <div className="flex h-full w-full max-w-[480px] flex-col border-l border-line bg-surface shadow-float">
            {/* Kepala Laci */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div>
                <h2 id="user-drawer-title" className="text-base font-semibold text-ink">
                  Ubah peran staf
                </h2>
                <p className="font-mono text-xs text-ink-muted">
                  {selectedUser.fullName} ({selectedUser.email})
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditDrawer}
                className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-hover hover:text-ink"
                aria-label="Tutup laci ubah peran"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Formulir Laci */}
            <form onSubmit={handleSaveRole} className="flex flex-1 flex-col justify-between overflow-y-auto p-6 space-y-6 text-xs text-ink">
              <div className="space-y-5">
                {/* Pilihan Radio Peran Sederhana Sesuai DESIGN.md Section 8.7 */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-2">
                    Pilih peran pengguna
                  </label>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-3 rounded-control border p-3 cursor-pointer transition-colors ${
                      editRole === 'CASHIER'
                        ? 'border-action bg-selected'
                        : 'border-line bg-surface hover:bg-hover'
                    }`}>
                      <input
                        type="radio"
                        name="user-role"
                        value="CASHIER"
                        checked={editRole === 'CASHIER'}
                        onChange={() => setEditRole('CASHIER')}
                        className="mt-0.5 text-action focus:ring-mint"
                      />
                      <div>
                        <div className="font-semibold text-ink">Kasir Operasional</div>
                        <div className="text-[11px] text-ink-muted">
                          Akses cepat modul penjualan POS kasir dan pencarian obat FEFO atomik
                        </div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 rounded-control border p-3 cursor-pointer transition-colors ${
                      editRole === 'PHARMACIST'
                        ? 'border-action bg-selected'
                        : 'border-line bg-surface hover:bg-hover'
                    }`}>
                      <input
                        type="radio"
                        name="user-role"
                        value="PHARMACIST"
                        checked={editRole === 'PHARMACIST'}
                        onChange={() => setEditRole('PHARMACIST')}
                        className="mt-0.5 text-action focus:ring-mint"
                      />
                      <div>
                        <div className="font-semibold text-ink">Apoteker Penanggung Jawab (APJ)</div>
                        <div className="text-[11px] text-ink-muted">
                          Otoritas verifikasi faktur PBF, buku defekta, dan penerbitan SP-el resmi
                        </div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 rounded-control border p-3 cursor-pointer transition-colors ${
                      editRole === 'OWNER'
                        ? 'border-action bg-selected'
                        : 'border-line bg-surface hover:bg-hover'
                    }`}>
                      <input
                        type="radio"
                        name="user-role"
                        value="OWNER"
                        checked={editRole === 'OWNER'}
                        onChange={() => setEditRole('OWNER')}
                        className="mt-0.5 text-action focus:ring-mint"
                      />
                      <div>
                        <div className="font-semibold text-ink">Pemilik Apotek</div>
                        <div className="text-[11px] text-ink-muted">
                          Akses penuh seluruh modul, analitik pendapatan, dan manajemen staf apotek
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Field Khusus Apoteker: Nomor SIPA & Tanggal Berakhir Sesuai DESIGN.md Section 8.7 */}
                {editRole === 'PHARMACIST' && (
                  <div className="space-y-4 rounded-panel border border-line-input/50 bg-sunken p-4">
                    <div>
                      <div className="font-semibold text-ink">
                        Informasi SIPA kefarmasian
                      </div>
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        Apoteker tanpa SIPA aktif tidak dapat menerbitkan Surat Pesanan Elektronik (SP-el).
                      </p>
                    </div>

                    <div>
                      <label htmlFor="edit-no-sipa" className="block text-xs font-medium text-ink">
                        Nomor SIPA resmi
                      </label>
                      <input
                        id="edit-no-sipa"
                        type="text"
                        required={editRole === 'PHARMACIST'}
                        value={editNoSipa}
                        onChange={(e) => setEditNoSipa(e.target.value)}
                        placeholder="Contoh: 19940815/SIPA_35.78/2023/2011"
                        className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 font-mono text-xs text-ink focus:border-action focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="edit-sipa-expiry" className="block text-xs font-medium text-ink">
                        Tanggal berakhir SIPA
                      </label>
                      <input
                        id="edit-sipa-expiry"
                        type="date"
                        required={editRole === 'PHARMACIST'}
                        value={editSipaExpiry}
                        onChange={(e) => setEditSipaExpiry(e.target.value)}
                        className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 font-mono text-xs text-ink focus:border-action focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Tombol Aksi Menempel di Dasar Laci */}
              <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={handleCloseEditDrawer}
                  className="flex h-10 items-center justify-center rounded-control border border-line-input bg-surface px-4 text-xs font-semibold text-ink hover:bg-hover active:bg-selected"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex h-10 items-center justify-center rounded-control bg-action px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-action-hover active:bg-action-press disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersSipaPage;
