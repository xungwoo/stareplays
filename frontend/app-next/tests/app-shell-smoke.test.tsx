import { metadata } from "@/app/layout";
import RootLayout from "@/app/layout";
import HomePage from "@/app/page";
import VaultPage from "@/app/vault/page";
import RankingsPage from "@/app/rankings/page";
import AnalyzerPage from "@/app/analyzer/page";
import TeamAnalysisPage from "@/app/team-analysis/page";
import type { ReactElement } from "react";
import { isValidElement } from "react";
import { vi } from "vitest";

import * as requestContext from "@/lib/utils/request-context";
import { buildCurrentUserSessionCookie } from "@/lib/utils/current-user-session";

describe("app shell smoke", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports root metadata", () => {
    expect(metadata.title).toBe("StaReplays");
    expect(metadata.description).toMatch(/Starcraft: Brood War 3v3 Replay Analytics/i);
  });

  it("imports the product route entry points", () => {
    expect(HomePage).toBeTypeOf("function");
    expect(VaultPage).toBeTypeOf("function");
    expect(RankingsPage).toBeTypeOf("function");
    expect(AnalyzerPage).toBeTypeOf("function");
    expect(TeamAnalysisPage).toBeTypeOf("function");
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
      backgroundColor: "#121826",
      color: "#e5e7eb",
      fontFamily: "'Inter', sans-serif"
    });
    expect(main.props.children.type).toBe("div");
    expect(footer.props.style).toEqual({ borderTop: "1px solid rgba(255,255,255,0.04)" });
  });

  it("initializes the header current user from the request cookie", () => {
    vi.spyOn(requestContext, "readCurrentUserCookieFromRequest").mockReturnValue(buildCurrentUserSessionCookie("cookie-user"));

    const layout = RootLayout({ children: <div>child</div> });

    if (!isValidElement(layout)) {
      throw new Error("RootLayout did not return a valid element");
    }

    const typedLayout = layout as ReactElement<{ children: ReactElement }>;
    const body = typedLayout.props.children as ReactElement<{
      children: ReactElement[];
    }>;
    const header = body.props.children[0] as ReactElement<{ currentUser?: string }>;

    expect(header.props.currentUser).toBe("cookie-user");
  });
});
