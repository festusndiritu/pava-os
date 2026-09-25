'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { settingsApi, type BusinessSettings } from '../../../lib/settings-api';
import { ApiError } from '../../../lib/api';
import { NumericInput, PhoneInput, toNumber } from '../../../components/ui/inputs';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          {description}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3.5">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [form, setForm] = useState<Partial<BusinessSettings>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Held as text while editing so the fields can be emptied and retyped.
  const [rounding, setRounding] = useState('');
  const [lowStock, setLowStock] = useState('');

  useEffect(() => {
    settingsApi.get().then((s) => {
      setSettings(s);
      setForm(s);
      setRounding(String(s.roundingIncrement));
      setLowStock(String(s.lowStockThreshold));
    });
  }, []);

  if (!hasPermission('SETTINGS')) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          You don't have access to this page.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const roundingIncrement = toNumber(rounding);
    const lowStockThreshold = toNumber(lowStock);
    if (roundingIncrement === null || roundingIncrement < 1) {
      setError('Rounding increment must be at least KSh 1.');
      return;
    }
    if (lowStockThreshold === null) {
      setError('Enter a low-stock threshold (0 turns the warning off).');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await settingsApi.update({
        businessName: form.businessName,
        address: form.address ?? undefined,
        phone: form.phone ?? undefined,
        email: form.email ?? undefined,
        quotePrefix: form.quotePrefix,
        invoicePrefix: form.invoicePrefix,
        receiptPrefix: form.receiptPrefix,
        roundingIncrement,
        lowStockThreshold,
        documentFooter: form.documentFooter ?? undefined,
        paymentDetails: form.paymentDetails ?? undefined,
      });
      setSettings(updated);
      setForm(updated);
      setRounding(String(updated.roundingIncrement));
      setLowStock(String(updated.lowStockThreshold));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="h-40 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-border)' }} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
          Settings
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Business identity, document numbering, and commercial defaults.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Section title="Business identity" description="Shown on printed quotes, invoices, and receipts.">
          <div>
            <label htmlFor="settings-business-name" className={labelClass} style={labelStyle}>Business name</label>
            <input id="settings-business-name" value={form.businessName ?? ''} onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="settings-address" className={labelClass} style={labelStyle}>Address</label>
            <input id="settings-address" value={form.address ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="settings-phone" className={labelClass} style={labelStyle}>Phone</label>
              <PhoneInput id="settings-phone" value={form.phone ?? ''} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="settings-email" className={labelClass} style={labelStyle}>Email</label>
              <input id="settings-email" value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
            </div>
          </div>
        </Section>

        <Section title="Document numbering" description="Prefixes for new quotes/invoices/receipts. The next number is shown for reference and increments automatically — it isn't editable here to avoid ever issuing a duplicate.">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="settings-quote-prefix" className={labelClass} style={labelStyle}>Quote prefix</label>
              <input id="settings-quote-prefix" value={form.quotePrefix ?? ''} onChange={(e) => setForm((f) => ({ ...f, quotePrefix: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
              <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>Next: {settings.quotePrefix}-{new Date().getFullYear()}-{String(settings.nextQuoteSeq).padStart(6, '0')}</p>
            </div>
            <div>
              <label htmlFor="settings-invoice-prefix" className={labelClass} style={labelStyle}>Invoice prefix</label>
              <input id="settings-invoice-prefix" value={form.invoicePrefix ?? ''} onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
              <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>Next: {settings.invoicePrefix}-{new Date().getFullYear()}-{String(settings.nextInvoiceSeq).padStart(6, '0')}</p>
            </div>
            <div>
              <label htmlFor="settings-receipt-prefix" className={labelClass} style={labelStyle}>Receipt prefix</label>
              <input id="settings-receipt-prefix" value={form.receiptPrefix ?? ''} onChange={(e) => setForm((f) => ({ ...f, receiptPrefix: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
              <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>Next: {settings.receiptPrefix}-{new Date().getFullYear()}-{String(settings.nextReceiptSeq).padStart(6, '0')}</p>
            </div>
          </div>
        </Section>

        <Section title="Commercial defaults">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="settings-rounding-increment-ksh" className={labelClass} style={labelStyle}>Rounding increment (KSh)</label>
              <NumericInput id="settings-rounding-increment-ksh" min={1} required value={rounding} onChange={setRounding} className="w-full rounded-md border px-3 py-2 text-sm data-num outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
              <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>POS rounds customer-facing unit prices up to the nearest multiple of this.</p>
            </div>
            <div>
              <label htmlFor="settings-low-stock-threshold" className={labelClass} style={labelStyle}>Low-stock threshold</label>
              <NumericInput id="settings-low-stock-threshold" required value={lowStock} onChange={setLowStock} className="w-full rounded-md border px-3 py-2 text-sm data-num outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
              <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>Products at or below this quantity show on the dashboard's low-stock list.</p>
            </div>
          </div>
        </Section>

        <Section title="Payment details" description="Bank / M-Pesa / till info — shown on quotes and invoices so a customer knows how to pay.">
          <textarea
            value={form.paymentDetails ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, paymentDetails: e.target.value }))}
            rows={3}
            placeholder={'e.g.\nM-Pesa Till: 123456\nBank: Equity, Acc. 0123456789'}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            style={inputStyle}
          />
        </Section>

        <Section title="Document footer" description="Printed at the bottom of quotes, invoices, and receipts.">
          <textarea value={form.documentFooter ?? ''} onChange={(e) => setForm((f) => ({ ...f, documentFooter: e.target.value }))} rows={2} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </Section>

        {error && (
          <p className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-sm" style={{ color: 'var(--color-status-ok)' }}>Saved</span>}
        </div>
      </form>
    </div>
  );
}