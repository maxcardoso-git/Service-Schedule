import { create } from 'zustand';

const TOKEN_KEY = 'auth_token';

export const useAuthStore = create((set) => ({
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: null,

  login(token, admin) {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, user: admin });
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null });
  },

  initFromToken() {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        set({ token: null, user: null });
        return;
      }

      const payload = JSON.parse(atob(token.split('.')[1]));

      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem(TOKEN_KEY);
        set({ token: null, user: null });
        return;
      }

      set({
        token,
        user: {
          id: payload.id,
          email: payload.email,
          name: payload.name,
          role: payload.role,
        },
      });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ token: null, user: null });
    }
  },
}));
