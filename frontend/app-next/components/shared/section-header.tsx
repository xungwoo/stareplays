interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
}

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 h-8 w-1.5 rounded-full bg-cyan" aria-hidden="true" />
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-mono font-bold uppercase tracking-[0.12em] text-text">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm text-slate-300">{description}</p> : null}
      </div>
    </div>
  );
}
