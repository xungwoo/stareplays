import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/"
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
