'use client';

import { waDigits } from './phone';

export type ShareResult = 'shared' | 'downloaded' | 'whatsapp-web';

export interface ShareOptions {
  /** Customer's number, so WhatsApp Web opens straight on their chat. */
  phone?: string | null;
  /** Pre-filled message text for that chat. */
  message?: string;
}

/** The line shown after a share. `label` names what was shared ("RCT-0042"). */
export function shareNotice(result: ShareResult, label: string): string {
  return result === 'shared' ? `Shared ${label}` : `Downloaded ${label}`;
}

// A phone or tablet has a share sheet with the person's installed apps in it,
// WhatsApp included, so that is the right hand-off there. A computer's share
// dialog (Windows) only lists installed apps — WhatsApp Web is a website, so
// it never appears, and most people on a work PC use the web version. There
// the file is downloaded and WhatsApp Web is opened next to it instead; the
// web client cannot be handed a file from a link, so the person drags it in.
function hasMobileShareSheet(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mobileUa = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return coarse || mobileUa;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function openWhatsAppWeb({ phone, message }: ShareOptions): boolean {
  const digits = phone ? waDigits(phone) : '';
  const params = new URLSearchParams();
  if (digits) params.set('phone', digits);
  if (digits && message) params.set('text', message);
  const url = digits ? `https://web.whatsapp.com/send?${params}` : 'https://web.whatsapp.com/';
  // Returns null when the browser's popup blocker refused the tab.
  return window.open(url, '_blank', 'noopener,noreferrer') !== null;
}

// Hands the file to the OS share sheet on a phone or tablet; on a computer it
// downloads the file and opens WhatsApp Web. Every caller generates the Blob
// with @react-pdf/renderer (see lib/pdf/document-pdf.tsx), and the marketing
// poster (see lib/poster.ts) draws to a <canvas>, but both share through
// this same path.
async function shareFileBlob(blob: Blob, filename: string, title: string, mimeType: string, options: ShareOptions): Promise<ShareResult> {
  const file = new File([blob], filename, { type: mimeType });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: ShareData) => Promise<void> };

  if (hasMobileShareSheet() && nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      // AbortError = the person cancelled the share sheet — not a failure.
      if (err instanceof Error && err.name === 'AbortError') return 'shared';
      // Otherwise fall through to the download fallback below.
    }
  }

  download(blob, filename);
  if (!hasMobileShareSheet() && openWhatsAppWeb(options)) return 'whatsapp-web';
  return 'downloaded';
}

export async function sharePdfBlob(blob: Blob, filename: string, title: string, options: ShareOptions = {}): Promise<ShareResult> {
  return shareFileBlob(blob, filename, title, 'application/pdf', options);
}

export async function shareImageBlob(blob: Blob, filename: string, title: string, options: ShareOptions = {}): Promise<ShareResult> {
  return shareFileBlob(blob, filename, title, 'image/png', options);
}
