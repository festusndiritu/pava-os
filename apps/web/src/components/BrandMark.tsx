export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg font-semibold"
      style={{
        width: size,
        height: size,
        backgroundColor: 'var(--color-ink-900)',
        color: 'var(--color-surface)',
        fontSize: size * 0.42,
        letterSpacing: '-0.02em',
      }}
      aria-hidden
    >
      P
    </div>
  );
}