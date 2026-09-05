import { BrandMark } from '../BrandMark';

export function BrandPanel() {
  return (
    <div
      className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex"
      style={{ backgroundColor: 'var(--color-ink-900)' }}
    >
      {/* Abstract, restrained artwork — nested square outlines evoke steel
          tube cross-sections without being a literal illustration. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-28 opacity-[0.08]"
        width="560"
        height="560"
        viewBox="0 0 560 560"
        fill="none"
      >
        <rect x="40" y="40" width="220" height="220" rx="6" stroke="white" strokeWidth="1.5" />
        <rect x="95" y="95" width="110" height="110" rx="3" stroke="white" strokeWidth="1.5" />
        <rect x="230" y="230" width="290" height="290" rx="6" stroke="white" strokeWidth="1.5" />
        <rect x="300" y="300" width="150" height="150" rx="3" stroke="white" strokeWidth="1.5" />
      </svg>
      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-[-140px] left-[-140px] opacity-[0.06]"
        width="420"
        height="420"
        viewBox="0 0 420 420"
        fill="none"
      >
        <rect x="30" y="30" width="180" height="180" rx="6" stroke="white" strokeWidth="1.5" />
        <rect x="75" y="75" width="90" height="90" rx="3" stroke="white" strokeWidth="1.5" />
      </svg>

      <div className="relative flex items-center gap-2.5">
        <BrandMark size={32} variant="on-dark" />
        <span className="text-sm font-semibold tracking-tight text-white">Pava OS</span>
      </div>

      <div className="relative max-w-sm">
        <h2 className="text-2xl font-semibold leading-snug tracking-tight text-white">
          Run the whole working day from one system.
        </h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Sales, inventory, customers, and more, in one place.
        </p>
      </div>

      <p className="relative text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
        © {new Date().getFullYear()} Pava Steel &amp; Hardware. All rights reserved.
      </p>
    </div>
  );
}