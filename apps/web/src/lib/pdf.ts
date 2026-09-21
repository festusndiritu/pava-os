'use client';

// Hands the file to the OS share sheet (WhatsApp included) where supported;
// otherwise downloads it so the person can attach it manually. This is the
// one piece of the old html2canvas/jsPDF pipeline that survived the
// rebuild — sharing a Blob has nothing to do with how its bytes were
// produced, and every caller now generates that Blob with
// @react-pdf/renderer (see lib/pdf/document-pdf.tsx) instead of capturing
// a DOM node.
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
