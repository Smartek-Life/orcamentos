export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function base64ToDataUrl(base64: string, mimeType = 'image/jpeg'): string {
  return `data:${mimeType};base64,${base64}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function distanceBetweenPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}
