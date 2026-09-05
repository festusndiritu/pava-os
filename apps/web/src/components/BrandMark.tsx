export function BrandMark({ size = 36, variant = 'default' }: { size?: number; variant?: 'default' | 'on-dark' }) {
  const onDark = variant === 'on-dark';
  return (
    <div
      className="flex items-center justify-center rounded-lg font-semibold select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: onDark ? 'transparent' : 'var(--color-ink-900)',
        color: onDark ? '#FFFFFF' : 'var(--color-surface)',
        border: onDark ? '1.5px solid rgba(255,255,255,0.4)' : 'none',
        fontSize: size * 0.42,
        letterSpacing: '-0.02em',
      }}
      aria-hidden
    >
      P
    </div>
  );
}