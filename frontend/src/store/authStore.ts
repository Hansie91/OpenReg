import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    full_name: string;
    tenant_id: string;
    is_superuser?: boolean;
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: number | null; // Unix timestamp in milliseconds
    isAuthenticated: boolean;
    isRefreshing: boolean;

    // Actions
    login: (accessToken: string, refreshToken: string, expiresIn: number, user: User) => void;
    logout: () => void;
    updateTokens: (accessToken: string, refreshToken: string, expiresIn: number) => void;
    setRefreshing: (isRefreshing: boolean) => void;

    // Helpers
    isTokenExpired: () => boolean;
    isTokenExpiringSoon: (thresholdSeconds?: number) => boolean;
    getAccessToken: () => string | null;
}

// Buffer time before actual expiry to trigger refresh (5 minutes)
const REFRESH_THRESHOLD_SECONDS = 300;

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isAuthenticated: false,
            isRefreshing: false,

            login: (accessToken, refreshToken, expiresIn, user) => {
                const expiresAt = Date.now() + (expiresIn * 1000);
                set({
                    accessToken,
                    refreshToken,
                    expiresAt,
                    user,
                    isAuthenticated: true,
                    isRefreshing: false,
                });
            },

            logout: () => {
                set({
                    accessToken: null,
                    refreshToken: null,
                    expiresAt: null,
                    user: null,
                    isAuthenticated: false,
                    isRefreshing: false,
                });
            },

            updateTokens: (accessToken, refreshToken, expiresIn) => {
                const expiresAt = Date.now() + (expiresIn * 1000);
                set({
                    accessToken,
                    refreshToken,
                    expiresAt,
                    isRefreshing: false,
                });
            },

            setRefreshing: (isRefreshing) => {
                set({ isRefreshing });
            },

            isTokenExpired: () => {
                const { expiresAt } = get();
                if (!expiresAt) return true;
                return Date.now() >= expiresAt;
            },

            isTokenExpiringSoon: (thresholdSeconds = REFRESH_THRESHOLD_SECONDS) => {
                const { expiresAt } = get();
                if (!expiresAt) return true;
                const thresholdMs = thresholdSeconds * 1000;
                return Date.now() >= (expiresAt - thresholdMs);
            },

            getAccessToken: () => {
                const { accessToken, isTokenExpired } = get();
                if (!accessToken || isTokenExpired()) {
                    return null;
                }
                return accessToken;
            },
        }),
        {
            name: 'auth-storage',
            // Only persist essential data, not functions or derived state
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                expiresAt: state.expiresAt,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

// Legacy compatibility - export token as alias for accessToken
// This helps during migration; can be removed later
export const getAuthToken = () => useAuthStore.getState().accessToken;
