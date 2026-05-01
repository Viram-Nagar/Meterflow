// import { create } from "zustand";
// import { persist } from "zustand/middleware";

// const useAuthStore = create(
//   persist(
//     (set, get) => ({
//       user: null,
//       accessToken: null,
//       isAuthenticated: false,

//       setAuth: (user, accessToken) => {
//         localStorage.setItem("accessToken", accessToken);
//         set({ user, accessToken, isAuthenticated: true });
//       },

//       updateUser: (user) => set({ user }),

//       logout: () => {
//         localStorage.removeItem("accessToken");
//         set({ user: null, accessToken: null, isAuthenticated: false });
//       },

//       isAdmin: () => get().user?.role === "admin",
//       isOwner: () => ["owner", "admin"].includes(get().user?.role),
//     }),
//     {
//       name: "meterflow-auth",
//       partialize: (state) => ({
//         user: state.user,
//         isAuthenticated: state.isAuthenticated,
//       }),
//     },
//   ),
// );

// export default useAuthStore;

/**
 * @file authStore.js
 * @description Zustand auth store with persistence.
 * Stores user data + auth state across page refreshes.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      // Called on login, register, AND after plan upgrade
      setAuth: (user, accessToken) => {
        // Always update localStorage token
        if (accessToken) {
          localStorage.setItem("accessToken", accessToken);
        }
        set({
          user,
          accessToken: accessToken || get().accessToken,
          isAuthenticated: true,
        });
      },

      // Called when only user data changes (profile update, plan upgrade)
      updateUser: (updatedUser) => {
        set((state) => ({
          user: { ...state.user, ...updatedUser },
        }));
      },

      // Called on logout
      logout: () => {
        localStorage.removeItem("accessToken");
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      // Helper getters
      isAdmin: () => get().user?.role === "admin",
      isOwner: () => ["owner", "admin"].includes(get().user?.role),
      currentPlan: () => get().user?.plan || "free",
    }),
    {
      name: "meterflow-auth",
      // Only persist user and auth state, not accessToken
      // (accessToken is in localStorage separately for axios interceptor)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export default useAuthStore;
