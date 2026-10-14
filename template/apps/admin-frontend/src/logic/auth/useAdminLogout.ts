import { useCallback } from "react";
import { adminLogout } from "./session";

export function useAdminLogout() {
  return useCallback(async () => {
    await adminLogout();
    window.location.reload();
  }, []);
}
