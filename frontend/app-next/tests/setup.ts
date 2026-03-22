import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

declare global {
  var __TEST_SEARCH_PARAMS__: string | undefined;
}

globalThis.__TEST_SEARCH_PARAMS__ = "";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(globalThis.__TEST_SEARCH_PARAMS__ ?? "")
}));

vi.mock("next/font/google", () => {
  const createFont = (variable: string) => ({
    className: variable.replace(/^--/, ""),
    style: { fontFamily: variable },
    variable
  });

  return {
    Inter: ({ variable = "--font-sans" }: { variable?: string }) => createFont(variable),
    Rajdhani: ({ variable = "--font-display" }: { variable?: string }) => createFont(variable),
    JetBrains_Mono: ({ variable = "--font-mono" }: { variable?: string }) => createFont(variable)
  };
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
