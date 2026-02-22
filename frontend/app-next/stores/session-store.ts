"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type SessionState = {
  currentUser: string;
  setCurrentUser: (name: string) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentUser: "",
      setCurrentUser: (name) => set({ currentUser: name.trim() })
    }),
    {
      name: "stareplays-session",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
