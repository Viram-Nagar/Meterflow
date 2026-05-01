// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import toast from "react-hot-toast";
// import api from "../services/api.service";
// import useAuthStore from "../store/authStore";

// // ── Hook — Upgrade Plan ───────────────────────────────────────────────────────
// export const useUpgradePlan = () => {
//   const qc = useQueryClient();
//   const { updateUser } = useAuthStore();

//   return useMutation({
//     mutationFn: async ({ plan, paymentDetails }) => {
//       // 1. Create order
//       const { data: orderData } = await api.post("/payments/order/plan", {
//         plan,
//       });
//       const order = orderData.data;

//       // 2. Process payment
//       const { data: payData } = await api.post("/payments/process", {
//         orderId: order.orderId,
//         ...paymentDetails,
//       });

//       return payData.data;
//     },
//     onSuccess: (data) => {
//       toast.success(`Upgraded to ${data.plan?.toUpperCase()} plan! 🎉`);
//       qc.invalidateQueries({ queryKey: ["me"] });
//       qc.invalidateQueries({ queryKey: ["billing"] });
//       qc.invalidateQueries({ queryKey: ["plans"] });
//     },
//     onError: (error) => {
//       toast.error(error.response?.data?.error?.message || "Payment failed");
//     },
//   });
// };

// // ── Hook — Pay Invoice ────────────────────────────────────────────────────────
// export const usePayInvoice = () => {
//   const qc = useQueryClient();

//   return useMutation({
//     mutationFn: async ({ cycleId, paymentDetails }) => {
//       const { data: orderData } = await api.post("/payments/order/invoice", {
//         cycleId,
//       });
//       const order = orderData.data;

//       const { data: payData } = await api.post("/payments/process", {
//         orderId: order.orderId,
//         ...paymentDetails,
//       });

//       return payData.data;
//     },
//     onSuccess: () => {
//       toast.success("Invoice paid successfully! ✅");
//       qc.invalidateQueries({ queryKey: ["billing"] });
//     },
//     onError: (error) => {
//       toast.error(error.response?.data?.error?.message || "Payment failed");
//     },
//   });
// };

// // ── Hook — Payment History ────────────────────────────────────────────────────
// export const usePaymentHistory = () =>
//   useQuery({
//     queryKey: ["payments", "history"],
//     queryFn: () => api.get("/payments/history").then((r) => r.data.data),
//   });

/**
 * @file usePayments.js
 * @description Mock payment hooks.
 * After successful payment, fetches fresh user data to update sidebar + UI.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../services/api.service";
import useAuthStore from "../store/authStore";

// ── Hook — Upgrade Plan ───────────────────────────────────────────────────────
export const useUpgradePlan = () => {
  const qc = useQueryClient();
  const { setAuth, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: async ({ plan, paymentDetails }) => {
      // 1. Create order
      const { data: orderData } = await api.post("/payments/order/plan", {
        plan,
      });
      const order = orderData.data;

      // 2. Process payment
      const { data: payData } = await api.post("/payments/process", {
        orderId: order.orderId,
        ...paymentDetails,
      });

      return payData.data;
    },
    onSuccess: async (data) => {
      toast.success(`Upgraded to ${data.plan?.toUpperCase()} plan! 🎉`);

      // ── KEY FIX: Fetch fresh user from backend and update Zustand ──────────
      try {
        const { data: meData } = await api.get("/auth/me");
        const freshUser = meData.data.user;
        // Update Zustand store with fresh user data including new plan
        setAuth(freshUser, accessToken);
      } catch (err) {
        // Fallback: just invalidate queries to trigger refetch
        console.warn("Could not refresh user after payment", err);
      }

      // Invalidate all related queries
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["plans"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || "Payment failed");
    },
  });
};

// ── Hook — Pay Invoice ────────────────────────────────────────────────────────
export const usePayInvoice = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ cycleId, paymentDetails }) => {
      const { data: orderData } = await api.post("/payments/order/invoice", {
        cycleId,
      });
      const order = orderData.data;

      const { data: payData } = await api.post("/payments/process", {
        orderId: order.orderId,
        ...paymentDetails,
      });

      return payData.data;
    },
    onSuccess: () => {
      toast.success("Invoice paid successfully! ✅");
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || "Payment failed");
    },
  });
};

// ── Hook — Payment History ────────────────────────────────────────────────────
export const usePaymentHistory = () =>
  useQuery({
    queryKey: ["payments", "history"],
    queryFn: () => api.get("/payments/history").then((r) => r.data.data),
  });
