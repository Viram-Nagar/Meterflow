import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../services/api.service";

export const useAPIs = (params = {}) =>
  useQuery({
    queryKey: ["apis", params],
    queryFn: () => api.get("/apis", { params }).then((r) => r.data),
  });

export const useAPI = (apiId) =>
  useQuery({
    queryKey: ["api", apiId],
    queryFn: () => api.get(`/apis/${apiId}`).then((r) => r.data.data.api),
    enabled: !!apiId,
  });

export const useCreateAPI = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/apis", data),
    onSuccess: () => {
      toast.success("API created!");
      qc.invalidateQueries({ queryKey: ["apis"] });
    },
  });
};

export const useUpdateAPI = (apiId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.patch(`/apis/${apiId}`, data),
    onSuccess: () => {
      toast.success("API updated!");
      qc.invalidateQueries({ queryKey: ["apis"] });
      qc.invalidateQueries({ queryKey: ["api", apiId] });
    },
  });
};

export const useDeleteAPI = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (apiId) => api.delete(`/apis/${apiId}`),
    onSuccess: () => {
      toast.success("API deleted");
      qc.invalidateQueries({ queryKey: ["apis"] });
    },
  });
};

export const useToggleAPI = (apiId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch(`/apis/${apiId}/toggle`),
    onSuccess: ({ data }) => {
      toast.success(`API ${data.data.api.status}`);
      qc.invalidateQueries({ queryKey: ["apis"] });
    },
  });
};

export const useAPIKeys = (apiId, params = {}) =>
  useQuery({
    queryKey: ["keys", apiId, params],
    queryFn: () =>
      api.get(`/apis/${apiId}/keys`, { params }).then((r) => r.data),
    enabled: !!apiId,
  });

export const useGenerateKey = (apiId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post(`/apis/${apiId}/keys`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys", apiId] }),
  });
};

export const useRevokeKey = (apiId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId) => api.patch(`/apis/${apiId}/keys/${keyId}/revoke`),
    onSuccess: () => {
      toast.success("Key revoked");
      qc.invalidateQueries({ queryKey: ["keys", apiId] });
    },
  });
};

export const useRotateKey = (apiId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId) => api.post(`/apis/${apiId}/keys/${keyId}/rotate`),
    onSuccess: () => {
      toast.success("Key rotated!");
      qc.invalidateQueries({ queryKey: ["keys", apiId] });
    },
  });
};
