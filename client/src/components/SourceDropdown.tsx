import { useState, useEffect, useRef } from 'react';

export const ALL_SOURCES = [
  'NZ Herald', 'RNZ', 'Stuff', 'AP News', 'NPR', 'The Guardian', 'CBS News',
] as const;

export type SourceName = typeof ALL_SOURCES[number];

interface Props {
  enabled: string[];
  onChange: (sources: string[]) => void;
}

export function SourceDropdown({ enabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const allOn = enabled.length === ALL_SOURCES.length;
  const label = allOn ? 'Sources' : `${enabled.length}/${ALL_SOURCES.length} sources`;

  function toggle(source: string) {
    if (enabled.includes(source)) {
      if (enabled.length === 1) return; // always keep at least one
      onChange(enabled.filter((s) => s !== source));
    } else {
      onChange([...enabled, source]);
    }
  }

  return (
    <div className="src-dd" ref={ref}>
      <button
        className={`src-dd__trigger${!allOn ? ' src-dd__trigger--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <span className="src-dd__chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="src-dd__panel">
          <div className="src-dd__quick">
            <button onClick={() => onChange([...ALL_SOURCES])}>All</button>
            <button onClick={() => { if (enabled.length < ALL_SOURCES.length) onChange([...ALL_SOURCES]); }}>Reset</button>
          </div>
          {ALL_SOURCES.map((source) => {
            const slug = source.toLowerCase().replace(/\s+/g, '-');
            const checked = enabled.includes(source);
            return (
              <label key={source} className="src-dd__item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(source)}
                />
                <span className={`src-dd__dot src-dd__dot--${slug}`} />
                {source}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
