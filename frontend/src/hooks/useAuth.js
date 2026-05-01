// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { useNavigate } from "react-router-dom";
// import toast from "react-hot-toast";
// import api from "../services/api.service";
// import useAuthStore from "../store/authStore";

// export const useLogin = () => {
//   const { setAuth } = useAuthStore();
//   const navigate = useNavigate();
//   return useMutation({
//     mutationFn: (data) => api.post("/auth/login", data),
//     onSuccess: ({ data }) => {
//       setAuth(data.data.user, data.data.accessToken);
//       toast.success("Welcome back!");
//       navigate("/dashboard");
//     },
//   });
// };

// export const useRegister = () => {
//   const { setAuth } = useAuthStore();
//   const navigate = useNavigate();
//   return useMutation({
//     mutationFn: (data) => api.post("/auth/register", data),
//     onSuccess: ({ data }) => {
//       setAuth(data.data.user, data.data.accessToken);
//       toast.success("Account created!");
//       navigate("/dashboard");
//     },
//   });
// };

// export const useLogout = () => {
//   const { logout } = useAuthStore();
//   const navigate = useNavigate();
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: () => api.post("/auth/logout"),
//     onSettled: () => {
//       logout();
//       qc.clear();
//       navigate("/login");
//     },
//   });
// };

// export const useMe = () => {
//   const { isAuthenticated } = useAuthStore();
//   return useQuery({
//     queryKey: ["me"],
//     queryFn: () => api.get("/auth/me").then((r) => r.data.data.user),
//     enabled: isAuthenticated,
//     staleTime: 1000 * 60 * 10,
//   });
// };

/**
 * @file useAuth.js
 * @description Auth hooks — login, register, logout, get current user.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api.service";
import useAuthStore from "../store/authStore";

export const useLogin = () => {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data) => api.post("/auth/login", data),
    onSuccess: ({ data }) => {
      setAuth(data.data.user, data.data.accessToken);
      toast.success("Welcome back!");
      navigate("/dashboard");
    },
  });
};

export const useRegister = () => {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data) => api.post("/auth/register", data),
    onSuccess: ({ data }) => {
      setAuth(data.data.user, data.data.accessToken);
      toast.success("Account created!");
      navigate("/dashboard");
    },
  });
};

export const useLogout = () => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled: () => {
      logout();
      qc.clear();
      navigate("/login");
    },
  });
};

/**
 * Fetch current user from backend.
 * Used by Sidebar to always show fresh plan/name data.
 * Also updates Zustand store when fresh data arrives.
 */
export const useMe = () => {
  const { isAuthenticated, updateUser } = useAuthStore();
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me");
      const user = data.data.user;
      // Always sync fresh user data into Zustand store
      updateUser(user);
      return user;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when user switches tabs
  });
};
