import { useQuery, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../services/api.service";

export const useCurrentBilling = () =>
  useQuery({
    queryKey: ["billing", "current"],
    queryFn: () => api.get("/billing/current").then((r) => r.data.data),
  });

export const useBillingHistory = () =>
  useQuery({
    queryKey: ["billing", "history"],
    queryFn: () => api.get("/billing/history").then((r) => r.data.data),
  });

export const usePlans = () =>
  useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get("/billing/plans").then((r) => r.data.data),
  });

export const useCalculateBill = () =>
  useMutation({
    mutationFn: (data) =>
      api.post("/billing/calculate", data).then((r) => r.data.data),
  });

export const useAnalyticsOverview = (params) =>
  useQuery({
    queryKey: ["analytics", "overview", params],
    queryFn: () =>
      api.get("/analytics/overview", { params }).then((r) => r.data.data),
  });

export const useUsageOverTime = (params) =>
  useQuery({
    queryKey: ["analytics", "usage", params],
    queryFn: () =>
      api.get("/analytics/usage", { params }).then((r) => r.data.data),
    enabled: true,
  });

export const useLatencyStats = (params) =>
  useQuery({
    queryKey: ["analytics", "latency", params],
    queryFn: () =>
      api.get("/analytics/latency", { params }).then((r) => r.data.data),
  });

export const useTopEndpoints = (params) =>
  useQuery({
    queryKey: ["analytics", "endpoints", params],
    queryFn: () =>
      api.get("/analytics/top-endpoints", { params }).then((r) => r.data.data),
  });
