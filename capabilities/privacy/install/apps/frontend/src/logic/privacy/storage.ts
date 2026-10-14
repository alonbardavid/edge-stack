export const DEVICE_TRACKING_KEY = "privacy.tracking";
export const POLICY_VERSION_KEY = "privacy.policy_version";
export const REGIME_KEY = "privacy.regime";

export type PrivacyStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

/** A browser that refuses storage leaves every decision unremembered. */
export function localPrivacyStorage(): PrivacyStorage {
  return {
    getItem: (key) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        return;
      }
    },
  };
}
