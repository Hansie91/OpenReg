import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  requestId?: string;
  duration?: number; // ms, default 5000
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { ...toast, id, duration: toast.duration ?? 5000 };
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    // Auto-remove after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, newToast.duration);
    }
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}));

// Convenience hook for common toast operations
export const useToast = () => {
  const { addToast, removeToast } = useToastStore();
  return {
    showSuccess: (title: string, message?: string) =>
      addToast({ type: 'success', title, message }),
    showError: (title: string, message?: string, requestId?: string) =>
      addToast({ type: 'error', title, message, requestId, duration: 8000 }),
    showWarning: (title: string, message?: string) =>
      addToast({ type: 'warning', title, message }),
    showInfo: (title: string, message?: string) =>
      addToast({ type: 'info', title, message }),
    dismiss: removeToast,
  };
};
