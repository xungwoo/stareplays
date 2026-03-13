"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
      <div>Unhandled UI error: {error.message}</div>
      <button className="mt-2 rounded-md border border-warning px-3 py-1 text-xs" onClick={() => reset()}>
        Retry
      </button>
    </div>
  );
}
