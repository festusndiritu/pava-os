'use client';

// PDF over PNG (brief step 7): preserves the letterhead exactly, and holds
// up for anything that runs past one page (a long invoice, a delivery
// note), which a single flat image can't do gracefully.

export async function elementToPdfBlob(elementId: string): Promise<Blob> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('Nothing to export yet');

  const [{ default: html2canvas }, jsPdfModule] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const { jsPDF } = jsPdfModule;

  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight);
  } else {
    // Long document (e.g. a delivery note with many lines) — slice the
    // captured image across as many A4 pages as it needs.
    let remaining = imgHeight;
    let position = 0;
    while (remaining > 0) {
      pdf.addImage(imgData, 'PNG', 0, position === 0 ? 0 : -position, pageWidth, imgHeight);
      remaining -= pageHeight;
      position += pageHeight;
      if (remaining > 0) pdf.addPage();
    }
  }

  return pdf.output('blob');
}

// Hands the file to the OS share sheet (WhatsApp included) where supported;
// otherwise downloads it so the person can attach it manually.
export async function sharePdfBlob(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: ShareData) => Promise<void> };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      // AbortError = the person cancelled the share sheet — not a failure.
      if (err instanceof Error && err.name === 'AbortError') return 'shared';
      // Otherwise fall through to the download fallback below.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

export async function shareElementAsPdf(elementId: string, filename: string, title: string) {
  const blob = await elementToPdfBlob(elementId);
  return sharePdfBlob(blob, filename, title);
}