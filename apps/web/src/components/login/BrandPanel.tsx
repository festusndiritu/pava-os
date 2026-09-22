import Image from 'next/image';

export function BrandPanel() {
  return (
    <div
      className="relative hidden min-h-screen overflow-hidden lg:flex"
      style={{ backgroundColor: 'var(--color-brand-panel)' }}
    >
      {/* Large structural geometry */}
      <svg
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 opacity-[0.07]"
        width="620"
        height="620"
        viewBox="0 0 620 620"
        fill="none"
      >
        <rect
          x="55"
          y="55"
          width="250"
          height="250"
          rx="8"
          stroke="white"
          strokeWidth="1.5"
        />
        <rect
          x="115"
          y="115"
          width="130"
          height="130"
          rx="4"
          stroke="white"
          strokeWidth="1.5"
        />
        <rect
          x="285"
          y="285"
          width="280"
          height="280"
          rx="8"
          stroke="white"
          strokeWidth="1.5"
        />
        <rect
          x="355"
          y="355"
          width="140"
          height="140"
          rx="4"
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      {/* Secondary construction lines */}
      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-[-180px] left-[-170px] opacity-[0.055]"
        width="520"
        height="520"
        viewBox="0 0 520 520"
        fill="none"
      >
        <rect
          x="35"
          y="35"
          width="230"
          height="230"
          rx="8"
          stroke="white"
          strokeWidth="1.5"
        />
        <rect
          x="90"
          y="90"
          width="120"
          height="120"
          rx="4"
          stroke="white"
          strokeWidth="1.5"
        />
        <path
          d="M265 35V485M35 265H485"
          stroke="white"
          strokeWidth="1"
        />
      </svg>

      {/* Subtle diagonal construction line */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] top-[48%] h-px w-[120%] rotate-[-18deg] opacity-[0.045]"
        style={{ backgroundColor: 'white' }}
      />

      <div className="relative z-10 flex w-full flex-col p-10">
        {/* Product identity */}
        <div className="flex items-center gap-2.5">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={34}
            height={34}
            className="rounded-lg"
            priority
          />

          <span className="text-sm font-semibold tracking-tight text-white">
            Pava OS
          </span>
        </div>

        {/* Main message */}
        <div className="my-auto max-w-md">
          <p
            className="mb-4 text-[11px] font-semibold uppercase"
            style={{
              color: 'rgba(255,255,255,0.48)',
              letterSpacing: '0.14em',
            }}
          >
            Business operations
          </p>

          <h2 className="text-3xl font-semibold leading-[1.15] tracking-tight text-white">
            Everything your working day needs.
          </h2>

          <p
            className="mt-5 max-w-sm text-sm leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.68)' }}
          >
            Sales, inventory, customers and daily operations —
            connected in one system.
          </p>

          {/* Product areas */}
          <div
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-medium uppercase"
            style={{
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.09em',
            }}
          >
            <span>Sales</span>
            <span>Inventory</span>
            <span>Customers</span>
            <span>Operations</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-end justify-between gap-6">
          <p
            className="text-xs"
            style={{ color: 'rgba(255,255,255,0.38)' }}
          >
            Mizzenmast Limited. All rights reserved.
          </p>

          <p
            className="text-xs"
            style={{ color: 'rgba(255,255,255,0.38)' }}
          >
            © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}