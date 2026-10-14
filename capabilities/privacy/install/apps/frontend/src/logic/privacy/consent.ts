import {
  PRIVACY_REGIMES,
  TRACKING_SETTINGS,
  type PrivacyConfig,
  type PrivacyRegime,
  type TrackingSetting,
} from "@lib/contract";
import {
  DEVICE_TRACKING_KEY,
  POLICY_VERSION_KEY,
  REGIME_KEY,
  type PrivacyStorage,
} from "./storage";

export type TrackingLock = "do_not_sell" | "gpc" | null;

export type PrivacyState = {
  /** null until the Worker has answered once and nothing is cached. */
  regime: PrivacyRegime | null;
  /** What applies right now, every rule considered. */
  tracking: TrackingSetting;
  /** The decision recorded against the signed-in account, if any. */
  accountTracking: TrackingSetting | null;
  /** The Worker has answered since load, so the account decision is known. */
  configured: boolean;
  needsBanner: boolean;
  isCalifornia: boolean;
  /** Why the browser-side switch cannot be turned on. */
  lockedBy: TrackingLock;
};

export type PrivacyController = {
  snapshot: () => PrivacyState;
  noteConfig: (config: PrivacyConfig) => void;
  setAccountTracking: (tracking: TrackingSetting | null) => void;
  /** The banner answer this device holds — an EU visitor's, kept locally. */
  deviceDecision: () => TrackingSetting | null;
  decideOnDevice: (tracking: TrackingSetting) => void;
  defaultTracking: () => TrackingSetting;
  subscribe: (listener: () => void) => () => void;
};

export type ConsentOptions = {
  storage: PrivacyStorage;
  /** An answer given against an older policy no longer stands. */
  policyVersion: string;
  globalPrivacyControl: boolean;
};

// Worst wins.
function strictest(a: TrackingSetting, b: TrackingSetting): TrackingSetting {
  return TRACKING_SETTINGS.indexOf(a) >= TRACKING_SETTINGS.indexOf(b) ? a : b;
}

const UNTIL_KNOWN: TrackingSetting = "server-only";

export function createConsent(options: ConsentOptions): PrivacyController {
  const { storage, policyVersion, globalPrivacyControl } = options;
  const listeners = new Set<() => void>();
  let accountTracking: TrackingSetting | null = null;
  let defaultTracking: TrackingSetting | null = null;
  let configured = false;
  let snapshot: PrivacyState | null = null;

  const notify = () => {
    snapshot = null;
    listeners.forEach((listener) => listener());
  };

  const regime = (): PrivacyRegime | null =>
    asRegime(storage.getItem(REGIME_KEY));

  const deviceDecision = (): TrackingSetting | null => {
    if (storage.getItem(POLICY_VERSION_KEY) !== policyVersion) {
      return null;
    }
    return asTracking(storage.getItem(DEVICE_TRACKING_KEY));
  };

  const fallback = (): TrackingSetting => {
    if (regime() === "EU") {
      return deviceDecision() ?? "server-only";
    }
    return defaultTracking ?? (regime() ? "enabled" : UNTIL_KNOWN);
  };

  // A Global Privacy Control signal is a refusal everywhere, and in California
  // it is the recognised opt-out of sale, which reaches further.
  const gpcFloor = (): TrackingSetting => {
    if (!globalPrivacyControl) {
      return "enabled";
    }
    return regime() === "CCPA" ? "disabled" : "server-only";
  };

  const compute = (): PrivacyState => {
    const tracking = strictest(accountTracking ?? fallback(), gpcFloor());
    return {
      regime: regime(),
      tracking,
      accountTracking,
      configured,
      needsBanner:
        regime() === "EU" &&
        !globalPrivacyControl &&
        accountTracking === null &&
        deviceDecision() === null,
      isCalifornia: regime() === "CCPA",
      lockedBy: lockedBy(accountTracking, tracking, globalPrivacyControl),
    };
  };

  return {
    snapshot: () => (snapshot ??= compute()),
    // Told on every answer the Worker gives, because a visitor can travel; the
    // stored regime only decides the first paint.
    noteConfig: (config) => {
      const changed =
        !configured ||
        storage.getItem(REGIME_KEY) !== config.regime ||
        defaultTracking !== config.defaultTracking ||
        accountTracking !== config.tracking;
      storage.setItem(REGIME_KEY, config.regime);
      defaultTracking = config.defaultTracking;
      accountTracking = config.tracking;
      configured = true;
      if (changed) {
        notify();
      }
    },
    setAccountTracking: (tracking) => {
      if (tracking === accountTracking) {
        return;
      }
      accountTracking = tracking;
      notify();
    },
    deviceDecision,
    decideOnDevice: (tracking) => {
      storage.setItem(DEVICE_TRACKING_KEY, tracking);
      storage.setItem(POLICY_VERSION_KEY, policyVersion);
      notify();
    },
    defaultTracking: () => defaultTracking ?? fallback(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function lockedBy(
  accountTracking: TrackingSetting | null,
  tracking: TrackingSetting,
  globalPrivacyControl: boolean,
): TrackingLock {
  if (accountTracking === "disabled") {
    return "do_not_sell";
  }
  return globalPrivacyControl && tracking !== "enabled" ? "gpc" : null;
}

function asRegime(value: string | null): PrivacyRegime | null {
  return PRIVACY_REGIMES.includes(value as PrivacyRegime)
    ? (value as PrivacyRegime)
    : null;
}

function asTracking(value: string | null): TrackingSetting | null {
  return TRACKING_SETTINGS.includes(value as TrackingSetting)
    ? (value as TrackingSetting)
    : null;
}
