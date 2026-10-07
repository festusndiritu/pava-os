import { Check } from 'lucide-react';
import { AVATAR_COLORS, avatarColor, initialsFor } from '../lib/constants';

export function Avatar({
  name,
  avatar,
  size = 40,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
}) {
  const { bg, fg } = avatarColor(avatar);
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold select-none shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontSize: Math.max(11, size * 0.38),
      }}
      aria-hidden
    >
      {initialsFor(name)}
    </div>
  );
}

/** The colour choices, each previewing the person's initials as they will appear. */
export function AvatarPicker({ name, value, onChange, size = 40 }: { name: string; value: string; onChange: (key: string) => void; size?: number }) {
  const initials = initialsFor(name) || 'AB';
  return (
    <div role="radiogroup" aria-label="Avatar colour" className="flex flex-wrap gap-2.5">
      {AVATAR_COLORS.map(({ key, bg, fg }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={key}
            title={key}
            onClick={() => onChange(key)}
            className="relative flex items-center justify-center rounded-full font-semibold select-none"
            style={{ width: size, height: size, backgroundColor: bg, color: fg, fontSize: Math.max(11, size * 0.38), outline: selected ? '2px solid var(--color-accent)' : 'none', outlineOffset: 2 }}
          >
            {initials}
            {selected && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ backgroundColor: 'var(--color-accent)', borderColor: 'var(--color-surface)', color: 'var(--color-on-accent)' }}>
                <Check size={9} strokeWidth={3.5} aria-hidden />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
