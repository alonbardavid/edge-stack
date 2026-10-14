import { createConsent } from "./consent";
import { localPrivacyStorage } from "./storage";
import { PRIVACY_POLICY_VERSION } from "../../screens/privacy/content";

export const privacy = createConsent({
  storage: localPrivacyStorage(),
  policyVersion: PRIVACY_POLICY_VERSION,
  globalPrivacyControl:
    (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl ===
    true,
});
