import { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function LoadingState({ text = "Loading..." }: { text?: string }) {
  return <Card className="text-sm text-fg/70">{text}</Card>;
}

export function EmptyState({ text }: { text: string }) {
  return <Card className="text-sm text-fg/70">{text}</Card>;
}

export function ErrorState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <Card className="border-warning/50 bg-warning/10 text-sm text-warning">
      <div>{text}</div>
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}
