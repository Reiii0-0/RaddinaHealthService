import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthTokenResponseDto, AuthUserDto } from '@shared/api-contracts';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUserDto | null;
  setSession: (
    payload:
      | AuthTokenResponseDto
      | { accessToken: string; refreshToken: string; user: AuthUserDto },
  ) => void;
  clearSession: () => void;
  updateUser: (user: AuthUserDto | Partial<AuthUserDto>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setSession: (payload) =>
        set({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          user: payload.user,
        }),

      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
        }),

      updateUser: (partialOrFullUser) =>
        set((state) => ({
          user: state.user
            ? ({ ...state.user, ...partialOrFullUser } as AuthUserDto)
            : (partialOrFullUser as AuthUserDto),
        })),
    }),
    {
      name: 'rhs_auth_session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
