import { useEffect, useRef, useState } from 'react';
import type { MapId, RoomSettings } from '../../shared/types';

const MAP_OPTIONS: ReadonlyArray<{ id: MapId; label: string }> = [
  { id: 'classic', label: 'Classic' },
  { id: 'mr-worldwide', label: 'Mr. Worldwide' },
  { id: 'death-valley', label: 'Death Valley' },
  { id: 'lucky-wheel', label: 'Lucky Wheel' },
];

const TOGGLES: ReadonlyArray<{ key: keyof RoomSettings; label: string; hint?: string }> = [
  { key: 'evenBuild', label: 'Even build' },
  { key: 'randomizePlayerOrder', label: 'Randomize turn order' },
  { key: 'vacationCash', label: 'Vacation cash' },
  { key: 'noRentInPrison', label: 'No rent while in prison' },
  { key: 'unlimitedBuildings', label: 'Unlimited buildings' },
  {
    key: 'antiCollusion',
    label: 'Anti-collusion (trades while in debt)',
    hint: "Off: a player in debt can only make trades that bring in cash (richup's rule). On: the trade must clear the debt or not lose them value.",
  },
];

/**
 * A number input that edits a local string draft. Controlling it straight from the server
 * value made clearing the box send 0 on the first backspace — which the server may refuse,
 * snapping the field back so it could never be retyped. The draft is only committed on
 * blur or Enter, and only if it parses and fits the bounds.
 */
function NumberField({
  value, min, max, step, disabled, onCommit,
}: {
  value: number;
  min: number;
  max?: number;
  step: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  // Host-side updates still show, but never overwrite what is being typed.
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = raw.trim() === '' ? NaN : Number(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min, Math.round(parsed)));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  }

  return (
    <input
      type="number" min={min} max={max} step={step}
      value={draft} disabled={disabled}
      onFocus={() => { focused.current = true; }}
      onBlur={e => { focused.current = false; commit(e.target.value); }}
      onKeyDown={e => { if (e.key === 'Enter') commit(e.currentTarget.value); }}
      onChange={e => {
        setDraft(e.target.value);
        // Keystrokes and pastes carry an `insert*`/`delete*` inputType; a spinner click or
        // arrow key does not, and is a finished choice rather than a half-typed number.
        const type = (e.nativeEvent as InputEvent).inputType ?? '';
        const typed = /^(insert|delete)/.test(type) && type !== 'insertReplacementText';
        if (!typed) commit(e.target.value);
      }}
    />
  );
}

export function SettingsPanel({
  settings, editable, onChange, playerCount = 0,
}: {
  settings: RoomSettings;
  editable: boolean;
  /** Seated players in the lobby; the player limit can't go below this. */
  playerCount?: number;
  onChange: (partial: Partial<RoomSettings>) => void;
}) {
  return (
    <div className="settings-panel">
      <section className="settings-panel__group">
        <h3 className="settings-panel__title">Game settings</h3>

        <label className="settings-panel__field">
          <span>Map</span>
          <select
            value={settings.mapId}
            disabled={!editable}
            onChange={e => onChange({ mapId: e.target.value as MapId })}
          >
            {MAP_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
        </label>

        <label className="settings-panel__field">
          <span>Starting cash</span>
          <NumberField
            value={settings.startingCash} min={0} step={100} disabled={!editable}
            onCommit={v => onChange({ startingCash: v })}
          />
        </label>

        <label className="settings-panel__field">
          <span>Max players</span>
          <NumberField
            value={settings.maxPlayers} min={Math.max(2, playerCount)} max={8} step={1} disabled={!editable}
            onCommit={v => onChange({ maxPlayers: v })}
          />
        </label>

        <label className="settings-panel__field">
          <span>Start salary</span>
          <NumberField
            value={settings.startSalary} min={0} step={10} disabled={!editable}
            onCommit={v => onChange({ startSalary: v })}
          />
        </label>

        <label className="settings-panel__field">
          <span>Prison fee</span>
          <NumberField
            value={settings.jailFee} min={0} step={10} disabled={!editable}
            onCommit={v => onChange({ jailFee: v })}
          />
        </label>
      </section>

      <section className="settings-panel__group">
        <h3 className="settings-panel__title settings-panel__title--rules">Gameplay rules</h3>
        {TOGGLES.map(({ key, label, hint }) => (
          <div key={key}>
            <label className="settings-panel__toggle">
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                disabled={!editable}
                onChange={e => onChange({ [key]: e.target.checked } as Partial<RoomSettings>)}
              />
              <span>{label}</span>
            </label>
            {hint && <p className="settings-panel__hint">{hint}</p>}
          </div>
        ))}
      </section>

      {!editable && <p className="settings-panel__note">Only the host can change settings.</p>}
    </div>
  );
}
