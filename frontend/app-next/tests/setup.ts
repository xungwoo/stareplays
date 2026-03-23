import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

declare global {
  var __TEST_SEARCH_PARAMS__: string | undefined;
  var __TEST_ROUTER__: {
    push: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };
}

globalThis.__TEST_SEARCH_PARAMS__ = "";
globalThis.__TEST_ROUTER__ = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn()
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(globalThis.__TEST_SEARCH_PARAMS__ ?? ""),
  useRouter: () => globalThis.__TEST_ROUTER__
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

const localStorageState = new Map<string, string>();
const localStorageMock = {
  get length() {
    return localStorageState.size;
  },
  clear() {
    localStorageState.clear();
  },
  getItem(key: string) {
    return localStorageState.has(key) ? localStorageState.get(key)! : null;
  },
  key(index: number) {
    return [...localStorageState.keys()][index] ?? null;
  },
  removeItem(key: string) {
    localStorageState.delete(key);
  },
  setItem(key: string, value: string) {
    localStorageState.set(String(key), String(value));
  }
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true
});
