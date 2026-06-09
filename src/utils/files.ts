/**
 * File I/O wrappers — wires up to `browser-fs-access` in Phase 7+ when the
 * first feature needs file open / save dialogs. Stubbed today so consumers
 * can already import from `@/utils/files`.
 */

export interface FileSaveOptions {
  fileName: string;
  blob: Blob;
}

export async function saveFile(options: FileSaveOptions): Promise<void> {
  const url = URL.createObjectURL(options.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = options.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
