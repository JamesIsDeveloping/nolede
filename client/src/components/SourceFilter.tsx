import { useEffect, useRef, useState } from 'react';

export const NZ_SOURCES = ['NZ Herald', 'RNZ', 'Stuff'];
export const INT_SOURCES = ['AP News', 'NPR', 'The Guardian', 'CBS News', 'Reuters'];
export const ALL_SOURCES = [...NZ_SOURCES, ...INT_SOURCES];

interface Props {
  enabled: string[];
  onChange: (sources: string[]) => void;
}

export function SourceFilter({ enabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const enabledSet = new Set(enabled);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggle(source: string) {
    if (enabledSet.has(source)) {
      if (enabled.length === 1) return; // keep at least one
      onChange(enabled.filter((s) => s !== source));
    } else {
      onChange([...enabled, source]);
    }
  }

  return (
    <div className="sf" ref={ref}>
      <button className="sf__trigger" onClick={() => setOpen(!open)}>
        Sources · <span className="sf__count">{enabled.length}/{ALL_SOURCES.length}</span>
        <span className="sf__chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="sf__panel">
          <div className="sf__quick">
            <button onClick={() => onChange([...NZ_SOURCES])}>NZ only</button>
            <button onClick={() => onChange([...ALL_SOURCES])}>All</button>
          </div>

          <div className="sf__group">
            <div className="sf__group-label">New Zealand</div>
            {NZ_SOURCES.map((s) => (
              <label key={s} className="sf__item">
                <input type="checkbox" checked={enabledSet.has(s)} onChange={() => toggle(s)} />
                <span>{s}</span>
              </label>
            ))}
          </div>

          <div className="sf__group">
            <div className="sf__group-label">International</div>
            {INT_SOURCES.map((s) => (
              <label key={s} className="sf__item">
                <input type="checkbox" checked={enabledSet.has(s)} onChange={() => toggle(s)} />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
