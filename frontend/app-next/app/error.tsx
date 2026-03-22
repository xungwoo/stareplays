"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function GlobalError() {
  return <ErrorState title="Workspace Error" description="StaReplays frontend preview failed to render." />;
}
