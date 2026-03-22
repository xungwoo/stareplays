import type { Metadata } from "next";

import { AnalyzerPage } from "@/components/analyzer/analyzer-page";
import { loadAnalyzerPageModel } from "@/lib/loaders/analyzer";

export const metadata: Metadata = {
  title: "StaReplays Game Analyzer",
  description: "Inspect timeline flow, resource spend, and player deep dive analytics."
};

export default async function AnalyzerRoutePage() {
  const model = await loadAnalyzerPageModel();

  return <AnalyzerPage model={model} />;
}
