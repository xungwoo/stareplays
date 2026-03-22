interface TabOption<T extends string> {
  id: T;
  label: string;
}

interface TabSwitcherProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: TabOption<T>[];
}

export function TabSwitcher<T extends string>({ value, onChange, options }: TabSwitcherProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.id === value;

        return (
          <button
            key={option.id}
            type="button"
            className={`rounded-lg border px-4 py-2 text-xs font-mono font-bold uppercase tracking-[0.16em] transition ${
              active ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-white/10 bg-panel text-muted hover:text-text"
            }`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
