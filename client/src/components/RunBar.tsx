import type { Run } from '../types';

interface Props {
  run: Run | null;
  onTrigger: () => void;
  triggering: boolean;
}

export function RunBar({ run, onTrigger, triggering }: Props) {
  return (
    <div className="run-bar">
      <div className="run-bar__info">
        {run ? (
          <>
            <span className={`run-bar__status run-bar__status--${run.status}`}>{run.status}</span>
            {run.completedAt && (
              <span className="run-bar__time">
                Last run: {new Date(run.completedAt).toLocaleString()}
              </span>
            )}
            {run.status === 'completed' && (
              <span className="run-bar__stats">
                {run.stats.kept} kept · {run.stats.discarded} discarded · {run.stats.deduplicated} deduped
              </span>
            )}
          </>
        ) : (
          <span className="run-bar__none">No runs yet</span>
        )}
      </div>
      <button className="run-bar__trigger" onClick={onTrigger} disabled={triggering}>
        {triggering ? 'Starting…' : 'Run now'}
      </button>
    </div>
  );
}
