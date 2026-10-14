import { useEffect, useState } from "react";
import { useSession } from "./client";

export function useMe() {
  const { data, isPending, refetch } = useSession();

  const [resolvedOnce, setResolvedOnce] = useState(false);
  useEffect(() => {
    if (!isPending) setResolvedOnce(true);
  }, [isPending]);

  return {
    isLoggedIn: !!data,
    name: data?.user.name ?? null,
    email: data?.user.email ?? null,
    isInitializing: isPending && !resolvedOnce,
    refresh: refetch,
  };
}
