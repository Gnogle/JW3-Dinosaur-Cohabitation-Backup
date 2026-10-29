import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { Creature } from '../domain/model';
import { compareText } from '../domain/text';

export function creatureLabel(creature: Creature): string {
  return `${creature.name} (${creature.category})`;
}

interface CreatureComboboxProps {
  creatures: Creature[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Searchable creature picker following the ARIA 1.2 combobox pattern.
 * Keys: ArrowDown/ArrowUp move through options, Enter selects, Escape closes.
 */
export function CreatureCombobox({ creatures, selectedId, onSelect }: CreatureComboboxProps) {
  const inputId = useId();
  const listId = useId();
  // null means "not typing": the input shows the current selection.
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const sorted = useMemo(
    () =>
      [...creatures].sort(
        (a, b) => compareText(a.name, b.name) || compareText(a.category, b.category) || compareText(a.id, b.id),
      ),
    [creatures],
  );
  const selected = sorted.find((creature) => creature.id === selectedId) ?? null;
  const term = (query ?? '').trim().toLowerCase();
  const options = useMemo(
    () => (term ? sorted.filter((creature) => creatureLabel(creature).toLowerCase().includes(term)) : sorted),
    [sorted, term],
  );
  const current = options.length > 0 ? Math.min(activeIndex, options.length - 1) : -1;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function choose(creature: Creature) {
    onSelect(creature.id);
    setQuery(null);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Enter': {
        if (!open) break;
        event.preventDefault();
        const option = options[current];
        if (option) choose(option);
        break;
      }
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
          setQuery(null);
        }
        break;
      default:
        break;
    }
  }

  return (
    <div className="combobox">
      <label htmlFor={inputId}>Dinosaur</label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && current >= 0 ? optionId(current) : undefined}
        placeholder="Type or pick a dinosaur"
        value={query ?? (selected ? creatureLabel(selected) : '')}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setOpen(false);
          setQuery(null);
        }}
      />
      <ul id={listId} role="listbox" aria-label="Creatures" className="options" hidden={!open}>
        {options.map((creature, index) => (
          <li
            key={creature.id}
            id={optionId(index)}
            role="option"
            aria-selected={creature.id === selectedId}
            className={index === current ? 'option option-active' : 'option'}
            // Keep focus in the input while the mouse picks an option.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(creature)}
          >
            {creatureLabel(creature)}
          </li>
        ))}
      </ul>
      {open && options.length === 0 && (
        <p className="hint" role="status">
          No dinosaur matches "{query}".
        </p>
      )}
    </div>
  );
}
