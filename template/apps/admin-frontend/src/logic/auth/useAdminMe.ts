import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "../api/orpc";

export function useAdminMe() {
  const {
    data: admin,
    isPending,
    refetch,
  } = useQuery(orpc.me.queryOptions({ retry: false }));

  const [resolvedOnce, setResolvedOnce] = useState(false);
  useEffect(() => {
    if (!isPending) setResolvedOnce(true);
  }, [isPending]);

  return {
    isLoggedIn: !!admin,
    username: admin?.username ?? null,
    isInitializing: isPending && !resolvedOnce,
    refresh: refetch,
  };
}
