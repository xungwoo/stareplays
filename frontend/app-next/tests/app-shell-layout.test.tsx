import { act, render, screen } from "@testing-library/react";

import { AppHeader } from "@/components/shell/app-header";
import { CURRENT_USER_CHANGE_EVENT } from "@/components/shell/current-user-chip";
import { buildCurrentUserSessionDocumentCookie, clearCurrentUserSessionDocumentCookie } from "@/lib/utils/current-user-session";

describe("app header", () => {
  it("renders the main navigation labels and current user chip", () => {
    const { container } = render(<AppHeader currentUser="neo_user" />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /replay vault/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /team analysis/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /seasons/i })).not.toBeInTheDocument();
    expect(screen.getByText(/current_user/i)).toBeInTheDocument();

    const header = container.querySelector("header");
    const logoIcon = container.querySelector("svg");
    const activeNav = screen.getByRole("link", { name: /dashboard/i });
    const currentUserChip = screen.getByText(/neo_user/i).closest("div, span");

    expect(header).toHaveClass("flex", "items-center", "justify-between", "px-3", "sm:px-6", "py-0");
    expect(header).not.toHaveClass("max-w-[1400px]");
    expect(header).toHaveStyle({
      backgroundColor: "rgba(18,24,38,0.96)",
      borderBottom: "1px solid rgba(148,163,184,0.14)"
    });
    expect(logoIcon).toHaveClass("text-cyan-300");
    expect(activeNav).toHaveClass("bg-cyan-500/15", "text-cyan-300", "border-cyan-500/30");
    expect(currentUserChip).toHaveClass("px-3", "py-1", "tracking-wider");
    expect(currentUserChip?.tagName).toBe("DIV");
  });

  it("updates the header chip when the current user session changes on the page", () => {
    render(<AppHeader currentUser="3x3_GG" />);

    act(() => {
      window.dispatchEvent(new CustomEvent(CURRENT_USER_CHANGE_EVENT, { detail: "3x3_smwoo" }));
    });

    expect(screen.getByText("성민")).toBeInTheDocument();
  });

  it("prefers the currentUser query param on client-side navigation", () => {
    document.cookie = buildCurrentUserSessionDocumentCookie("cookie-user");
    globalThis.__TEST_SEARCH_PARAMS__ = "currentUser=query-user";

    const { rerender } = render(<AppHeader currentUser="fallback-user" />);

    expect(screen.getByText("query-user")).toBeInTheDocument();
    expect(screen.queryByText("cookie-user")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /replay vault/i })).toHaveAttribute("href", "/vault?currentUser=query-user");
    expect(screen.getByRole("link", { name: /team analysis/i })).toHaveAttribute("href", "/team-analysis?currentUser=query-user");
    expect(screen.getByRole("link", { name: /rankings/i })).toHaveAttribute("href", "/rankings?currentUser=query-user");
    expect(screen.queryByRole("link", { name: /seasons/i })).not.toBeInTheDocument();

    globalThis.__TEST_SEARCH_PARAMS__ = "";
    rerender(<AppHeader currentUser="fallback-user" />);

    expect(screen.getByText("cookie-user")).toBeInTheDocument();
    expect(screen.queryByText("query-user")).not.toBeInTheDocument();

    document.cookie = clearCurrentUserSessionDocumentCookie();
    globalThis.__TEST_SEARCH_PARAMS__ = "";
  });
});
