import { CATEGORIES, type Category } from '../types';

const LABELS: Record<Category, string> = {
  politics:     'Politics',
  sports:       'Sports',
  business:     'Business',
  crime:        'Crime',
  world:        'World',
  environment:  'Environment',
  health:       'Health',
  entertainment:'Entertainment',
  local:        'Local',
};

interface Props {
  selected: Category | null;
  onChange: (cat: Category | null) => void;
}

export function CategoryFilter({ selected, onChange }: Props) {
  return (
    <div className="catbar" role="toolbar" aria-label="Filter by category">
      <button
        className={`catbar__pill${selected === null ? ' catbar__pill--active' : ''}`}
        onClick={() => onChange(null)}
      >
        All
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          className={`catbar__pill catbar__pill--${cat}${selected === cat ? ' catbar__pill--active' : ''}`}
          onClick={() => onChange(selected === cat ? null : cat)}
        >
          {LABELS[cat]}
        </button>
      ))}
    </div>
  );
}
