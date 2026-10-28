export default function Loading() {
  return (
    <div className="p-6" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-40 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
    </div>
  );
}
