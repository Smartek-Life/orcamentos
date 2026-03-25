export function buildProjectKey(fileName: string, fileSize: number, pageCount: number): string {
  return `${fileName}__${fileSize}__${pageCount}`;
}

export async function buildProjectFingerprint(file: File): Promise<string> {
  const headerSize = Math.min(file.size, 1024 * 1024);
  const headerBytes = await file.slice(0, headerSize).arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', headerBytes);
  const hash = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');

  return `${hash}_${file.size}`;
}
