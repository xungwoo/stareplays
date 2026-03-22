import { render, screen } from "@testing-library/react";

import { AppHeader } from "@/components/shell/app-header";

describe("app header", () => {
  it("renders the main navigation labels and current user chip", () => {
    const { container } = render(<AppHeader />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /replay vault/i })).toBeInTheDocument();
    expect(screen.getByText(/current_user/i)).toBeInTheDocument();

    const header = container.querySelector("header");
    const logoIcon = container.querySelector("svg");
    const activeNav = screen.getByRole("link", { name: /dashboard/i });
    const currentUserChip = screen.getByText(/3x3_GG/i).closest("div, span");

    expect(header).toHaveClass("flex", "items-center", "justify-between", "px-6", "py-0");
    expect(header).not.toHaveClass("max-w-[1400px]");
    expect(header).toHaveStyle({
      backgroundColor: "#080e1f",
      borderBottom: "1px solid rgba(34,211,238,0.15)"
    });
    expect(logoIcon).toHaveClass("text-cyan-400");
    expect(activeNav).toHaveClass("bg-cyan-500/15", "text-cyan-300", "border-cyan-500/30");
    expect(currentUserChip).toHaveClass("px-3", "py-1", "tracking-wider");
    expect(currentUserChip?.tagName).toBe("DIV");
  });
});
