import { render, screen } from "@testing-library/react";

import { EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { RaceBadge } from "@/components/shared/race-badge";
import { SectionAccent } from "@/components/shared/section-accent";
import { SectionHeader } from "@/components/shared/section-header";
import { ResultBadge, StatusBadge } from "@/components/shared/status-badge";

describe("shared primitives", () => {
  it("renders shared content primitives", () => {
    const { container } = render(
      <div>
        <SectionHeader eyebrow="Metrics" title="Rankings_3v3" />
        <MetricCard label="Total Games" value="43" accent="cyan" />
        <RaceBadge race="P" />
        <RaceBadge race="T" />
        <RaceBadge race="Z" size="md" />
        <StatusBadge status="DONE" />
        <StatusBadge status="DONE" size="md" />
        <ResultBadge result="WINNER" size="md" />
        <ResultBadge result="LOSER" />
        <EmptyState title="No data" description="Nothing here yet" />
      </div>
    );

    expect(screen.getByText("Rankings_3v3")).toBeInTheDocument();
    expect(screen.getByText("Total Games")).toBeInTheDocument();
    expect(screen.getAllByText("DONE")).toHaveLength(2);
    expect(screen.getByText("No data")).toBeInTheDocument();

    const pBadge = screen.getByText("P");
    const tBadge = screen.getByText("T");
    const zBadge = screen.getByText("Z");
    const doneBadge = screen.getAllByText("DONE")[0];
    const winnerBadge = screen.getByText("WINNER");
    const loserBadge = screen.getByText("LOSER");

    expect(pBadge).toHaveStyle({
      backgroundColor: "rgba(245, 158, 11, 0.2)",
      color: "#fcd34d",
      border: "1px solid rgba(245, 158, 11, 0.4)"
    });
    expect(tBadge).toHaveStyle({
      backgroundColor: "rgba(59, 130, 246, 0.2)",
      color: "#93c5fd",
      border: "1px solid rgba(59, 130, 246, 0.4)"
    });
    expect(zBadge).toHaveStyle({
      backgroundColor: "rgba(168, 85, 247, 0.2)",
      color: "#d8b4fe",
      border: "1px solid rgba(168, 85, 247, 0.4)"
    });
    expect(doneBadge).toHaveStyle({
      backgroundColor: "rgba(6, 182, 212, 0.2)",
      color: "#67e8f9",
      border: "1px solid rgba(6, 182, 212, 0.4)"
    });
    expect(winnerBadge).toHaveStyle({
      backgroundColor: "rgba(16, 185, 129, 0.2)",
      color: "#6ee7b7",
      border: "1px solid rgba(16, 185, 129, 0.4)"
    });
    expect(loserBadge).toHaveStyle({
      backgroundColor: "rgba(239, 68, 68, 0.2)",
      color: "#fca5a5",
      border: "1px solid rgba(239, 68, 68, 0.4)"
    });
  });

  it("renders the cyan panel wrapper with the legacy outer card styles", () => {
    render(<Panel variant="cyan">Cyan panel</Panel>);

    expect(screen.getByText("Cyan panel")).toHaveStyle({
      backgroundColor: "#0d1833",
      border: "1px solid rgba(34,211,238,0.1)"
    });
  });

  it("renders the inner panel wrapper with the legacy dark panel styles", () => {
    render(<Panel variant="inner">Inner panel</Panel>);

    expect(screen.getByText("Inner panel")).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.05)"
    });
  });

  it("renders the innerStrong panel wrapper with the legacy stronger dark panel styles", () => {
    render(<Panel variant="innerStrong">Inner strong panel</Panel>);

    expect(screen.getByText("Inner strong panel")).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.06)"
    });
  });

  it("renders the section accent bar with the legacy cyan marker styles", () => {
    const { container } = render(<SectionAccent />);
    const accent = container.firstElementChild as HTMLElement;

    expect(accent).toHaveClass("w-1.5", "h-5", "rounded-sm");
    expect(accent).toHaveStyle({
      backgroundColor: "#22d3ee"
    });
  });
});
