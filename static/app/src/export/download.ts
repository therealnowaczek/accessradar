/** Client-side download (Custom UI iframe allows downloads triggered by a user gesture). No egress. */
export function download(filename: string, content: string | Uint8Array, mime: string) {
  const part: BlobPart = typeof content === 'string' ? content : new Uint8Array(content);
  const blob = new Blob([part], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadCsv = (filename: string, csv: string) =>
  download(filename, csv, 'text/csv;charset=utf-8');

export const downloadPdf = (filename: string, bytes: Uint8Array) =>
  download(filename, bytes, 'application/pdf');
