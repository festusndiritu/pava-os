'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/inputs';
import { ProductPicker } from '../products/ProductPicker';
import { toast } from '../ui/Toast';
import { ApiError } from '../../lib/api';
import { documentsApi, type EditRequest, type SaleDocument } from '../../lib/documents-api';
import { money } from '../../lib/format';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const muted = { color: 'var(--color-ink-600)' };

interface DraftLine {
  key: string;
  itemId?: string;
  productId?: string;
  description: string;
  qty: string;
  unitPrice: string;
}

// An existing line's price before transport was folded into it. Re-sending the
// folded price together with the transport amount would charge transport twice.
function negotiatedUnit(doc: SaleDocument, item: SaleDocument['items'][number]) {
  if (doc.transportMode !== 'DISTRIBUTED') return item.unitPrice;
  return Math.round((item.lineTotal - item.transportAllocated - item.roundingAdjustment) / item.qty);
}

/**
 * Staff propose a correction to an issued invoice or receipt: change what was
 * sold, at what quantity and price, and the transport. Nothing on the
 * document changes until an admin approves it.
 */
export function EditRequestDialog({ doc, onClose, onSent }: { doc: SaleDocument; onClose: () => void; onSent: () => void }) {
  const [lines, setLines] = useState<DraftLine[]>(() =>
    doc.items.map((i) => ({
      key: i.id,
      itemId: i.id,
      productId: i.productId ?? undefined,
      description: i.description,
      qty: String(i.qty),
      unitPrice: String(negotiatedUnit(doc, i)),
    })),
  );
  const [transport, setTransport] = useState(String(doc.transportAmount || ''));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const itemized = doc.transportMode === 'ITEMIZED';

  const num = (s: string) => parseInt(s, 10) || 0;
  const estimate = useMemo(() => lines.reduce((sum, l) => sum + num(l.qty) * num(l.unitPrice), 0) + num(transport), [lines, transport]);
  const valid = lines.length > 0 && lines.every((l) => num(l.qty) >= 1 && l.unitPrice !== '') && reason.trim().length >= 3;

  function patch(key: string, change: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...change } : l)));
  }

  async function submit() {
    setBusy(true);
    try {
      await documentsApi.requestEdit(doc.id, {
        reason: reason.trim(),
        items: lines.map((l) => ({
          itemId: l.itemId,
          productId: l.productId,
          // Only a manual line (no product) carries its own description.
          description: l.productId ? undefined : l.description,
          qty: num(l.qty),
          unitPrice: num(l.unitPrice),
        })),
        transportAmount: num(transport) || undefined,
        foldTransportIntoPrices: !itemized,
      });
      toast.success('Sent for admin approval');
      onSent();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send the edit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Request an edit" className="p-5 sm:max-w-lg">
      <h2 className="text-base font-semibold" style={{ color: 'var(--color-ink-900)' }}>
        Request an edit
      </h2>
      <p className="mt-1 text-sm" style={muted}>
        Nothing changes until an admin approves. Change quantities and prices, remove or add items, or fix the transport.
      </p>

      <div className="mt-4 flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
        {lines.map((l) => (
          <div key={l.key} className="rounded-md border p-2" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {l.description}
              </span>
              <button type="button" aria-label={`Remove ${l.description}`} onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} disabled={lines.length === 1} className="rounded p-1 disabled:opacity-30" style={muted}>
                <X size={15} />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs" style={muted}>
                Qty
                <NumericInput value={l.qty} onChange={(qty) => patch(l.key, { qty })} min={1} className="data-num mt-1 min-h-10 w-full rounded-md border px-2 text-right text-sm" style={inputStyle} />
              </label>
              <label className="text-xs" style={muted}>
                Unit price
                <NumericInput value={l.unitPrice} onChange={(unitPrice) => patch(l.key, { unitPrice })} className="data-num mt-1 min-h-10 w-full rounded-md border px-2 text-right text-sm" style={inputStyle} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <p className="mb-1 flex items-center gap-1 text-xs font-medium" style={muted}>
          <Plus size={12} /> Add an item
        </p>
        <ProductPicker
          onSelect={(p) =>
            setLines((prev) => [...prev, { key: `new-${p.id}-${prev.length}`, productId: p.id, description: p.displayName ?? p.name, qty: '1', unitPrice: String(p.basePrice) }])
          }
        />
      </div>

      <label className="mt-4 flex items-center justify-between gap-3 text-sm" style={muted}>
        Transport{itemized ? ' (own line)' : ''}
        <NumericInput value={transport} onChange={setTransport} placeholder="0" className="data-num min-h-10 w-36 rounded-md border px-2 text-right" style={inputStyle} />
      </label>

      <label className="mt-3 block text-xs font-medium" style={muted}>
        Why is this being corrected?
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className="mt-1 w-full rounded-md border p-2 text-sm font-normal" style={inputStyle} />
      </label>

      <div className="mt-3 flex items-baseline justify-between text-sm">
        <span style={muted}>Was {money(doc.total)} · estimated now</span>
        <span className="data-num font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          {money(estimate)}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className="min-h-10 flex-1 rounded-md border px-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
          Cancel
        </button>
        <button type="button" disabled={!valid || busy} onClick={submit} className="min-h-10 flex-1 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>
          {busy ? 'Sending…' : 'Send for approval'}
        </button>
      </div>
    </Modal>
  );
}

const STATUS_STYLE = {
  PENDING: { label: 'Waiting for approval', fg: 'var(--color-status-warn)' },
  APPROVED: { label: 'Approved', fg: 'var(--color-status-ok)' },
  REJECTED: { label: 'Rejected', fg: 'var(--color-status-bad)' },
} as const;

/** One edit request: what changes, and — for an admin on a pending one — Approve / Reject. */
export function EditRequestCard({
  request,
  isAdmin,
  paid,
  showDocument,
  onDecided,
}: {
  request: EditRequest;
  isAdmin: boolean;
  /** The sale is already paid, so a change in total has to be settled in cash, M-Pesa or credit. */
  paid: boolean;
  showDocument?: boolean;
  onDecided: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [settlement, setSettlement] = useState<'CASH' | 'MPESA' | 'CREDIT'>('CASH');
  const diff = request.proposedTotal - request.previousTotal;
  const status = STATUS_STYLE[request.status];
  const doc = request.document;

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      if (approve) {
        await documentsApi.approveEdit(request.id, { note: note.trim() || undefined, settlement: paid && diff !== 0 ? settlement : undefined });
        toast.success('Edit approved and applied');
      } else {
        await documentsApi.rejectEdit(request.id, { note: note.trim() || undefined });
        toast.success('Edit rejected');
      }
      onDecided();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't record the decision");
    } finally {
      setBusy(false);
    }
  }

  const rows = (list?: { description: string; qty: number; unitPrice: number }[]) => (list ?? []).map((l) => `${l.qty} × ${l.description} @ ${money(l.unitPrice)}`);
  const before = rows(request.changes.before);
  const after = rows(request.changes.after);

  return (
    <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
          {showDocument && doc ? `${doc.receiptNumber ?? doc.invoiceNumber ?? 'Document'} · ${doc.customer?.businessName || doc.customer?.name || doc.customerName || 'Walk-in'}` : `${request.requestedBy?.name ?? 'Staff'} asked for an edit`}
        </span>
        <span className="text-xs font-medium" style={{ color: status.fg }}>
          {status.label}
        </span>
      </div>
      <p className="mt-1 text-sm" style={muted}>
        “{request.reason}”{showDocument && request.requestedBy ? ` — ${request.requestedBy.name}` : ''}
      </p>

      <div className="mt-2 grid grid-cols-2 gap-3 text-xs" style={muted}>
        <div>
          <p className="mb-1 font-semibold uppercase tracking-wide">Now</p>
          {before.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
          {(request.changes.before_transport ?? 0) > 0 && <p>Transport {money(request.changes.before_transport ?? 0)}</p>}
        </div>
        <div>
          <p className="mb-1 font-semibold uppercase tracking-wide">Proposed</p>
          {after.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
          {(request.changes.transportAmount ?? 0) > 0 && <p>Transport {money(request.changes.transportAmount ?? 0)}</p>}
        </div>
      </div>

      <p className="data-num mt-2 text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
        {money(request.previousTotal)} → {money(request.proposedTotal)}
        <span className="ml-2 text-xs font-normal" style={{ color: diff === 0 ? undefined : diff > 0 ? 'var(--color-status-warn)' : 'var(--color-status-ok)' }}>
          {diff === 0 ? 'no change in total' : diff > 0 ? `customer owes ${money(diff)} more` : `${money(-diff)} back to the customer`}
        </span>
      </p>

      {request.decisionNote && (
        <p className="mt-1 text-xs" style={muted}>
          {request.decidedBy?.name ?? 'Admin'}: {request.decisionNote}
        </p>
      )}

      {isAdmin && request.status === 'PENDING' && (
        <div className="mt-3 flex flex-col gap-2">
          {paid && diff !== 0 && (
            <div className="flex items-center gap-2 text-xs" style={muted}>
              {diff > 0 ? 'Collected by' : 'Given back by'}
              {(diff > 0 ? (['CASH', 'MPESA'] as const) : (['CASH', 'MPESA', 'CREDIT'] as const)).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSettlement(m)}
                  className="min-h-8 rounded-md border px-2 font-medium"
                  style={{
                    borderColor: settlement === m ? 'var(--color-accent)' : 'var(--color-border)',
                    color: settlement === m ? 'var(--color-accent)' : 'var(--color-ink-600)',
                  }}
                >
                  {m === 'MPESA' ? 'M-Pesa' : m === 'CASH' ? 'Cash' : 'Customer credit'}
                </button>
              ))}
            </div>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={500} className="min-h-9 rounded-md border px-2 text-sm" style={inputStyle} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => decide(false)} className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-md border px-3 text-sm font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
              <X size={14} /> Reject
            </button>
            <button type="button" disabled={busy} onClick={() => decide(true)} className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
              <Check size={14} /> Approve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Every edit waiting for an admin, across all documents. */
export function EditRequestsDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [requests, setRequests] = useState<EditRequest[] | null>(null);

  function load() {
    documentsApi
      .listEditRequests('PENDING')
      .then(setRequests)
      .catch(() => setRequests([]));
  }
  useEffect(load, []);

  return (
    <Modal onClose={onClose} label="Edits waiting for approval" className="p-5 sm:max-w-xl">
      <h2 className="text-base font-semibold" style={{ color: 'var(--color-ink-900)' }}>
        Edits waiting for approval
      </h2>
      <div className="mt-3 flex max-h-[65vh] flex-col gap-3 overflow-y-auto">
        {requests === null && <p className="text-sm" style={muted}>Loading…</p>}
        {requests?.length === 0 && <p className="text-sm" style={muted}>Nothing is waiting.</p>}
        {requests?.map((r) => (
          <EditRequestCard
            key={r.id}
            request={r}
            isAdmin
            paid={r.document?.status === 'PAID'}
            showDocument
            onDecided={() => {
              load();
              onChanged();
            }}
          />
        ))}
      </div>
    </Modal>
  );
}
