'use client';

import { useState } from 'react';
import { useAuth } from '../../../../lib/auth-context';
import { productsApi } from '../../../../lib/products-api';
import { LookupManager } from '../../../../components/products/setup/LookupManager';
import { UnitsManager } from '../../../../components/products/setup/UnitsManager';
import { FamiliesManager } from '../../../../components/products/setup/FamiliesManager';

type Tab = 'categories' | 'brands' | 'units' | 'families';

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: 'categories', label: 'Categories', blurb: 'How products are grouped — Pipes, Roofing, Cement. Used for filtering and price lists.' },
  { id: 'brands', label: 'Brands', blurb: 'Who makes what you stock. Optional on a product.' },
  { id: 'units', label: 'Units', blurb: 'What a product is counted in. Every product needs one.' },
  { id: 'families', label: 'Families', blurb: 'Group variants of the same product — e.g. a pipe size across gauges — for search, marketing, and shared low-stock alerts.' },
];

export default function CatalogueSetupPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('categories');
  const canEdit = user?.role === 'ADMIN';
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
        Catalogue setup
      </h1>
      <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
        The lists products are described with.{!canEdit && ' Only an admin can change them.'}
      </p>

      <div role="tablist" aria-label="Catalogue lists" className="mt-5 flex gap-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className="-mb-px min-h-10 border-b-2 px-3.5 text-sm font-medium"
            style={{ borderColor: tab === t.id ? 'var(--color-accent)' : 'transparent', color: tab === t.id ? 'var(--color-ink-900)' : 'var(--color-ink-600)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm" style={{ color: 'var(--color-ink-600)' }}>
        {active.blurb}
      </p>

      <div className="mt-4" role="tabpanel">
        {tab === 'categories' && (
          <LookupManager
            key="categories"
            noun="category"
            nounPlural="categories"
            emptyHint="Add the groups you sell under — they become a filter on Products and organise your price lists."
            canEdit={canEdit}
            api={{ list: productsApi.categories, create: productsApi.createCategory, rename: productsApi.renameCategory, remove: productsApi.deleteCategory }}
          />
        )}
        {tab === 'brands' && (
          <LookupManager
            key="brands"
            noun="brand"
            nounPlural="brands"
            emptyHint="Add the manufacturers you stock. You can also add one on the spot while creating a product."
            canEdit={canEdit}
            api={{ list: productsApi.brands, create: productsApi.createBrand, rename: productsApi.renameBrand, remove: productsApi.deleteBrand }}
          />
        )}
        {tab === 'units' && <UnitsManager key="units" canEdit={canEdit} />}
        {tab === 'families' && <FamiliesManager key="families" canEdit={canEdit} />}
      </div>
    </div>
  );
}
