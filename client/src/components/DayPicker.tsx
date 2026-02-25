import type { Run } from '../types';

interface Props {
  runs: Run[];
  selectedId: string | null; // null = always show latest
  onChange: (id: string | null) => void;
}

function runLabel(run: Run): string {
  const date = new Date(run.completedAt ?? run.startedAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Keep only the most recent run per calendar day (runs must be sorted newest-first). */
function dedupeByDay(runs: Run[]): Run[] {
  const seen = new Set<string>();
  return runs.filter((run) => {
    const key = new Date(run.completedAt ?? run.startedAt).toDateString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function DayPicker({ runs, selectedId, onChange }: Props) {
  const dayRuns = dedupeByDay(runs);
  if (dayRuns.length < 2) return null;

  return (
    <div className="daypicker" role="toolbar" aria-label="Browse by day">
      {dayRuns.map((run, i) => {
        // Index 0 is the most recent run; selecting it means "latest" (null)
        const isActive = i === 0 ? selectedId === null : selectedId === run._id;
        return (
          <button
            key={run._id}
            className={`daypicker__btn${isActive ? ' daypicker__btn--active' : ''}`}
            onClick={() => onChange(i === 0 ? null : run._id)}
          >
            {runLabel(run)}
          </button>
        );
      })}
    </div>
  );
}
