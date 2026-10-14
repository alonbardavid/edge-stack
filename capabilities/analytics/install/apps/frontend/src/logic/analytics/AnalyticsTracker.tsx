import { useEffect } from "react";
import { useMe } from "../authentication/useMe";
import { analytics } from "./client";

/** Ties the browser's events to the signed-in user. */
export const AnalyticsTracker = () => {
  const { userId, name, email } = useMe();
  useEffect(() => {
    if (userId) {
      analytics.identify(userId, { email, name });
    }
  }, [userId, email, name]);
  return null;
};
