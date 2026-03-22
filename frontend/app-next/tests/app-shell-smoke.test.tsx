import { metadata } from "@/app/layout";
import RootLayout from "@/app/layout";
import HomePage from "@/app/page";
import VaultPage from "@/app/vault/page";
import RankingsPage from "@/app/rankings/page";
import AnalyzerPage from "@/app/analyzer/page";
import type { ReactElement } from "react";
import { isValidElement } from "react";

describe("app shell smoke", () => {
  it("exports root metadata", () => {
    expect(metadata.title).toBe("StaReplays");
    expect(metadata.description).toMatch(/Starcraft: Brood War 3v3 Replay Analytics/i);
  });

  it("imports the four route entry points", () => {
    expect(HomePage).toBeTypeOf("function");
    expect(VaultPage).toBeTypeOf("function");
    expect(RankingsPage).toBeTypeOf("function");
    expect(AnalyzerPage).toBeTypeOf("function");
  });

  it("renders the footer copy used by the source shell", () => {
    const layout = RootLayout({ children: <div>child</div> });

    expect(isValidElement(layout)).toBe(true);

    if (!isValidElement(layout)) {
      throw new Error("RootLayout did not return a valid element");
    }

    const typedLayout = layout as ReactElement<{ children: ReactElement }>;
    const body = typedLayout.props.children as ReactElement<{
      children: ReactElement[];
      style?: {
        backgroundColor?: string;
        color?: string;
        fontFamily?: string;
      };
    }>;
    const main = body.props.children[1];
    const footer = body.props.children[2];

    expect(body.props.style).toEqual({
      backgroundColor: "#080e1f",
      color: "#e2e8f0",
      fontFamily: "'Inter', sans-serif"
    });
    expect(main.props.children.type).toBe("div");
    expect(footer.props.style).toEqual({ borderTop: "1px solid rgba(255,255,255,0.04)" });
  });
});
