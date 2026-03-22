"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { parseCurrentUserSessionCookie } from "@/lib/utils/current-user-session";

export const CURRENT_USER_CHANGE_EVENT = "stareplays:current-user-change";

function CurrentUserChipLabel({ activeUser }: { activeUser: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-slate-600">CURRENT_USER</span>
      <div
        className="rounded px-3 py-1 text-xs font-mono font-bold tracking-wider"
        style={{ backgroundColor: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.25)" }}
      >
        {activeUser}
      </div>
    </div>
  );
}

export function CurrentUserChipFallback({ currentUser }: { currentUser: string }) {
  return <CurrentUserChipLabel activeUser={currentUser} />;
}

export function CurrentUserChip({ currentUser }: { currentUser: string }) {
  const [activeUser, setActiveUser] = useState(currentUser);
  const searchParams = useSearchParams();
  const queryCurrentUser = searchParams.get("currentUser")?.trim();
  const cookieCurrentUser = typeof document === "undefined" ? null : parseCurrentUserSessionCookie(document.cookie);

  useEffect(() => {
    setActiveUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    function handleCurrentUserChange(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      const nextUser = detail?.trim();
      if (nextUser) {
        setActiveUser(nextUser);
      }
    }

    window.addEventListener(CURRENT_USER_CHANGE_EVENT, handleCurrentUserChange as EventListener);
    return () => {
      window.removeEventListener(CURRENT_USER_CHANGE_EVENT, handleCurrentUserChange as EventListener);
    };
  }, []);

  return <CurrentUserChipLabel activeUser={queryCurrentUser || cookieCurrentUser || activeUser} />;
}
