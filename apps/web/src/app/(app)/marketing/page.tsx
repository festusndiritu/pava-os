'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Image as ImageIcon, ListChecks, Megaphone, Printer, Search, Share2 } from 'lucide-react';
import { productsApi, type Product } from '../../../lib/products-api';
import { thicknessLabel } from '../../../lib/shape-config';
import { settingsApi, type BusinessSettings } from '../../../lib/settings-api';
import { sharePricelistAsPdf } from '../../../lib/pdf/document-pdf';
import { shareImageBlob } from '../../../lib/pdf';
import { drawPoster, posterCategoriesFromProducts, posterToBlob } from '../../../lib/poster';
import { fmtNumber } from '../../../lib/format';

type Mode = 'pricelist' | 'poster';

export default function MarketingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerSearch, setPickerSearch] = useState('');
  const [mode, setMode] = useState<Mode>('pricelist');
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  // Price list state
  const [title, setTitle] = useState('PAVA STEEL HARDWARE');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // Poster state
  const [headline, setHeadline] = useState("This week's prices");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterNotice, setPosterNotice] = useState<string | null>(null);

  useEffect(() => {
    productsApi.list().then((p) => setProducts(p.filter((x) => x.active)));
    settingsApi.get().then(setSettings).catch(() => {});
  }, []);

  const q = pickerSearch.trim().toLowerCase();
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Product[]>();
    for (const p of products) {
      if (q && !(p.displayName ?? p.name).toLowerCase().includes(q)) continue;
      const key = p.category?.name ?? 'Uncategorised';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(p);
    }
    return Array.from(byCategory.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [products, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCategory(items: Product[]) {
    const allOn = items.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Set(prev);
      items.forEach((p) => (allOn ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  }

  const selectedProducts = products.filter((p) => selected.has(p.id));

  const groupedSelected = useMemo(() => {
    const byCategory = new Map<string, Product[]>();
    for (const p of selectedProducts) {
      const key = p.category?.name ?? 'Other';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(p);
    }
    return Array.from(byCategory.entries());
  }, [selectedProducts]);

  const textBlock = useMemo(() => {
    if (selectedProducts.length === 0) return '';
    const lines = [title.toUpperCase(), ''];
    for (const [category, items] of groupedSelected) {
      lines.push(category.toUpperCase());
      for (const p of items) {
        const gauge = thicknessLabel(p.shape, p.thicknessMm);
        const label = [p.displayName ?? p.name, [p.nominalSize, gauge].filter(Boolean).join(' ')].filter(Boolean).join(' — ');
        lines.push(`${label}    KSh ${fmtNumber(p.basePrice)}`);
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }, [selectedProducts, title, groupedSelected]);

  function copyText() {
    navigator.clipboard.writeText(textBlock);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleShare() {
    setSharing(true);
    setShareNotice(null);
    try {
      const result = await sharePricelistAsPdf({
        title: title.trim() || 'PAVA STEEL HARDWARE',
        address: settings?.address ?? null,
        phone: settings?.phone ?? null,
        email: settings?.email ?? null,
        categories: groupedSelected.map(([category, items]) => ({
          name: category,
          items: items.map((p) => ({
            id: p.id,
            label: [p.displayName ?? p.name, [p.nominalSize, thicknessLabel(p.shape, p.thicknessMm)].filter(Boolean).join(' ')].filter(Boolean).join(' — '),
            price: p.basePrice,
          })),
        })),
      });
      setShareNotice(result === 'shared' ? 'Shared.' : 'Downloaded — attach it in WhatsApp or wherever you need it.');
    } catch {
      setShareNotice('Could not generate the PDF.');
    } finally {
      setSharing(false);
    }
  }

  // Redraws whenever the selection, headline or business details change —
  // the canvas is the source of truth for what gets shared, not a preview
  // of something built separately.
  useEffect(() => {
    if (mode !== 'poster') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawPoster(canvas, {
      businessName: settings?.businessName || 'Pava Steel Hardware',
      headline: headline.trim() || "This week's prices",
      phone: settings?.phone ?? null,
      categories: posterCategoriesFromProducts(groupedSelected),
    });
  }, [mode, groupedSelected, headline, settings]);

  async function handlePosterShare() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPosterBusy(true);
    setPosterNotice(null);
    try {
      const blob = await posterToBlob(canvas);
      if (!blob) throw new Error('canvas produced no blob');
      const filename = `${(headline || 'poster').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'poster'}.png`;
      const result = await shareImageBlob(blob, filename, headline || 'Price poster');
      setPosterNotice(result === 'shared' ? 'Shared.' : 'Downloaded — share it from your gallery or files.');
    } catch {
      setPosterNotice('Could not generate the poster.');
    } finally {
      setPosterBusy(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Marketing
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Pick products once, then export them as a text pricelist or a shareable poster.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5">
        {([
          { key: 'pricelist' as const, label: 'Price list', icon: ListChecks },
          { key: 'poster' as const, label: 'Poster', icon: ImageIcon },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMode(t.key)}
            className="flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
            style={{
              borderColor: mode === t.key ? 'var(--color-accent)' : 'var(--color-border)',
              backgroundColor: mode === t.key ? 'var(--color-accent-soft)' : 'transparent',
              color: mode === t.key ? 'var(--color-accent)' : 'var(--color-ink-600)',
            }}
          >
            <t.icon size={14} strokeWidth={2} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
              <input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Find a product…"
                className="w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' }}
              />
            </div>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="shrink-0 text-xs font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Clear ({selected.size})
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {grouped.length === 0 && (
              <p className="rounded-lg border px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}>
                No products match &ldquo;{pickerSearch}&rdquo;.
              </p>
            )}
            {grouped.map(([category, items]) => {
              const allOn = items.every((p) => selected.has(p.id));
              return (
                <div key={category} className="rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>{category}</p>
                    <button type="button" onClick={() => toggleCategory(items)} className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
                      {allOn ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 p-3">
                    {items.map((p) => {
                      const gauge = thicknessLabel(p.shape, p.thicknessMm);
                      return (
                        <label key={p.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--color-bg)]">
                          <span className="flex items-center gap-2">
                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                            <span style={{ color: 'var(--color-ink-900)' }}>
                              {p.displayName ?? p.name}
                              {gauge ? <span style={{ color: 'var(--color-ink-600)' }}> · {gauge}</span> : null}
                            </span>
                          </span>
                          <span className="data-num shrink-0" style={{ color: 'var(--color-ink-600)' }}>KSh {fmtNumber(p.basePrice)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {mode === 'pricelist' ? (
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-4 w-full rounded-md border px-3 py-2 text-sm font-medium outline-none focus:border-[var(--color-accent)]"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' }}
            />
            <div className="sticky top-4 rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>Preview</h2>
                <div className="flex gap-2">
                  <button type="button" onClick={copyText} disabled={!textBlock} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                    <Copy size={13} strokeWidth={2} />
                    {copied ? 'Copied' : 'Copy text'}
                  </button>
                  <button type="button" onClick={() => window.print()} disabled={!textBlock} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                    <Printer size={13} strokeWidth={2} />
                    Print
                  </button>
                  <button type="button" onClick={handleShare} disabled={!textBlock || sharing} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40" style={{ backgroundColor: 'var(--color-accent)' }}>
                    <Share2 size={13} strokeWidth={2} />
                    {sharing ? 'Preparing…' : 'Share PDF'}
                  </button>
                </div>
              </div>
              {shareNotice && (
                <p className="mb-3 rounded-md px-3 py-2 text-xs" style={{ backgroundColor: 'var(--color-status-okSoft)', color: 'var(--color-status-ok)' }}>
                  {shareNotice}
                </p>
              )}
              {textBlock ? (
                <pre className="whitespace-pre-wrap rounded-md p-4 font-mono text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}>
                  {textBlock}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Megaphone size={28} strokeWidth={1.5} className="mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>Select products on the left to build a shareable pricelist.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="This week's prices"
              className="mb-4 w-full rounded-md border px-3 py-2 text-sm font-medium outline-none focus:border-[var(--color-accent)]"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' }}
            />
            <div className="sticky top-4 rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>Preview</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const canvas = canvasRef.current;
                      if (!canvas) return;
                      const blob = await posterToBlob(canvas);
                      if (!blob) return;
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${(headline || 'poster').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'poster'}.png`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                    disabled={selectedProducts.length === 0}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
                  >
                    <Download size={13} strokeWidth={2} />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={handlePosterShare}
                    disabled={selectedProducts.length === 0 || posterBusy}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    <Share2 size={13} strokeWidth={2} />
                    {posterBusy ? 'Preparing…' : 'Share poster'}
                  </button>
                </div>
              </div>
              {posterNotice && (
                <p className="mb-3 rounded-md px-3 py-2 text-xs" style={{ backgroundColor: 'var(--color-status-okSoft)', color: 'var(--color-status-ok)' }}>
                  {posterNotice}
                </p>
              )}
              {selectedProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ImageIcon size={28} strokeWidth={1.5} className="mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>Select products on the left to build a poster.</p>
                </div>
              ) : (
                <div className="mx-auto max-w-sm overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
                  <canvas ref={canvasRef} className="block h-auto w-full" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full letterhead layout used for the price list's Print/Share — off-
          screen on the page itself (see .pdf-capture-offscreen). The poster
          has no equivalent: it's drawn straight onto the <canvas> above,
          which is both the preview and the exported image. */}
      <div id="print-area" className="print-a4 pdf-capture-offscreen">
        <div style={{ textAlign: 'center', marginBottom: '8mm', borderBottom: '2px solid #111827', paddingBottom: '6mm' }}>
          <p style={{ fontSize: '18px', fontWeight: 700 }}>{title || 'PAVA STEEL HARDWARE'}</p>
          {settings?.address && <p style={{ color: '#4b5563' }}>{settings.address}</p>}
          <p style={{ color: '#4b5563' }}>{[settings?.phone, settings?.email].filter(Boolean).join(' · ')}</p>
        </div>
        {groupedSelected.map(([category, items]) => (
          <div key={category} style={{ marginBottom: '6mm' }}>
            <p style={{ fontWeight: 700, borderBottom: '1px solid #111827', paddingBottom: '1mm', marginBottom: '2mm' }}>{category.toUpperCase()}</p>
            {items.map((p) => {
              const gauge = thicknessLabel(p.shape, p.thicknessMm);
              const label = [p.displayName ?? p.name, [p.nominalSize, gauge].filter(Boolean).join(' ')].filter(Boolean).join(' — ');
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1mm 0' }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 600 }}>KSh {fmtNumber(p.basePrice)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
