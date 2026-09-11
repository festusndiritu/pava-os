'use client';

import { Check } from 'lucide-react';
import { MODULE_GROUPS, MODULE_LABELS, type ModuleKey } from '../../lib/constants';

export function PermissionEditor({ value, onChange }: { value: ModuleKey[]; onChange: (next: ModuleKey[]) => void }) {
  const set = new Set(value);

  function toggle(module: ModuleKey) {
    const next = new Set(set);
    next.has(module) ? next.delete(module) : next.add(module);
    onChange([...next]);
  }

  function toggleGroup(modules: ModuleKey[]) {
    const allOn = modules.every((m) => set.has(m));
    const next = new Set(set);
    modules.forEach((m) => (allOn ? next.delete(m) : next.add(m)));
    onChange([...next]);
  }

  return (
    <div className="flex flex-col gap-4">
      {MODULE_GROUPS.map((group) => {
        const allOn = group.modules.every((m) => set.has(m));
        return (
          <div key={group.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
                {group.label}
              </p>
              <button type="button" onClick={() => toggleGroup(group.modules)} className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
                {allOn ? 'Clear' : 'Grant all'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.modules.map((m) => {
                const on = set.has(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggle(m)}
                    className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      borderColor: on ? 'var(--color-accent)' : 'var(--color-border)',
                      backgroundColor: on ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                      color: on ? 'var(--color-accent)' : 'var(--color-ink-900)',
                    }}
                  >
                    {on && <Check size={13} strokeWidth={2.5} />}
                    {MODULE_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}