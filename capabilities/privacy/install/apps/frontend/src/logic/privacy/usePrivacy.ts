import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import type { TrackingSetting } from "@lib/contract";
import { orpc } from "../api/orpc";
import { publicOrpc } from "../api/publicOrpc";
import { useMe } from "../authentication/useMe";
import { analytics, applyTrackingSetting } from "../analytics/client";
import { privacy } from "./store";
import type { PrivacyState } from "./consent";

export function usePrivacyState(): PrivacyState {
  return useSyncExternalStore(privacy.subscribe, privacy.snapshot);
}

/**
 * Keeps the store told what the Worker knows: which rules apply here and what
 * the signed-in account decided. Asked again whenever who is signed in changes.
 */
export function usePrivacyConfig(): void {
  const { userId } = useMe();
  const { data: config } = useQuery({
    ...publicOrpc.getPrivacyConfig.queryOptions(),
    queryKey: [...publicOrpc.getPrivacyConfig.queryKey(), userId],
  });

  useEffect(() => {
    if (config) {
      privacy.noteConfig(config);
    }
  }, [config]);
}

/** The SDK starts opted out, so this is what ever turns capturing on. */
export function useTrackingApplied(): void {
  const { tracking } = usePrivacyState();
  useEffect(() => applyTrackingSetting(tracking), [tracking]);
}

/**
 * A decision made on this device before signing in follows the account once
 * there is one, and a Californian's Global Privacy Control signal is recorded
 * as the opt-out it is — once per sign-in, so a later explicit change wins.
 */
export function usePrivacySync(): void {
  const { userId } = useMe();
  const { regime, accountTracking, lockedBy, isCalifornia } = usePrivacyState();
  const push = usePushTracking();
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || regime === null || synced.current === userId) {
      return;
    }
    const wanted = wantedOnSignIn(accountTracking, lockedBy, isCalifornia);
    if (wanted === null) {
      return;
    }
    synced.current = userId;
    push(wanted);
  }, [userId, regime, accountTracking, lockedBy, isCalifornia, push]);
}

function wantedOnSignIn(
  accountTracking: TrackingSetting | null,
  lockedBy: PrivacyState["lockedBy"],
  isCalifornia: boolean,
): TrackingSetting | null {
  if (lockedBy === "gpc" && isCalifornia) {
    return accountTracking === "disabled" ? null : "disabled";
  }
  if (accountTracking === null) {
    return privacy.deviceDecision();
  }
  return null;
}

export type PrivacyChoice = PrivacyState & {
  answerBanner: (accepted: boolean) => void;
  setBrowserTracking: (enabled: boolean) => void;
  setDoNotSell: (optedOut: boolean) => void;
};

export function usePrivacyChoice(): PrivacyChoice {
  const state = usePrivacyState();
  const { isLoggedIn } = useMe();
  const push = usePushTracking();

  const decide = (tracking: TrackingSetting, surface: string) => {
    if (state.regime === "EU") {
      privacy.decideOnDevice(tracking);
    }
    // Opted in here rather than by the effect: a capture made while the SDK
    // is still opted out is dropped, and this answer is worth knowing.
    applyTrackingSetting(tracking);
    if (tracking === "enabled") {
      analytics.capture("consent_answered", { decision: "granted", surface });
    }
    if (isLoggedIn) {
      push(tracking);
    }
  };

  return {
    ...state,
    answerBanner: (accepted) =>
      decide(accepted ? "enabled" : "server-only", "banner"),
    setBrowserTracking: (enabled) =>
      decide(enabled ? "enabled" : "server-only", "settings"),
    setDoNotSell: (optedOut) =>
      push(
        optedOut
          ? "disabled"
          : (privacy.deviceDecision() ?? privacy.defaultTracking()),
      ),
  };
}

function usePushTracking() {
  const { mutateAsync } = useMutation(
    orpc.setTrackingSetting.mutationOptions(),
  );
  const queryClient = useQueryClient();

  return useCallback(
    (tracking: TrackingSetting) => {
      privacy.setAccountTracking(tracking);
      void mutateAsync({ tracking })
        .catch(() =>
          notifications.show({
            color: "red",
            message: "Could not save your privacy choice. Try again.",
          }),
        )
        .finally(() =>
          queryClient.invalidateQueries({
            queryKey: publicOrpc.getPrivacyConfig.key(),
          }),
        );
    },
    [mutateAsync, queryClient],
  );
}
