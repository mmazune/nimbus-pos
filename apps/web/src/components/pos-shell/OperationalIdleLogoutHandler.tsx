import { useRouter } from "next/router";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import {
  OPERATIONAL_ACTIVITY_EVENTS,
  OPERATIONAL_IDLE_TIMEOUT_MS,
} from "@/components/pos-shell/idle";

export function OperationalIdleLogoutHandler() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId = window.setTimeout(handleIdle, OPERATIONAL_IDLE_TIMEOUT_MS);

    function resetTimer() {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(handleIdle, OPERATIONAL_IDLE_TIMEOUT_MS);
    }

    function handleIdle() {
      void logout().finally(() => {
        if (typeof window !== "undefined") {
          window.location.replace("/login?reason=idle_timeout");
          return;
        }

        void router.replace("/login?reason=idle_timeout");
      });
    }

    OPERATIONAL_ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    return () => {
      window.clearTimeout(timeoutId);
      OPERATIONAL_ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [isAuthenticated, logout, router]);

  return null;
}
