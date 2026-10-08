import { useAuthStore } from "@/stores/authStore";

/**
 * Thin hook over the auth store, exposing the pieces components need
 * without reaching into the store directly.
 */
export const useAuth = () => {
  const { user, token, isAuthenticated, isLoading } = useAuthStore();
  return { user, token, isAuthenticated, isLoading };
};
