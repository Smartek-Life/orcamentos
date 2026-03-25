import type { EditablePlan, SpeakerDevice } from '../../types';

const SPEAKER_WIDTH_M = 0.2;
const SPEAKER_HEIGHT_M = 0.3;
export const SPEAKER_HIT_MARGIN_PX = 6;
const MIN_WIDTH_PX = 24;
const MIN_HEIGHT_PX = 36;

export function getSpeakerBoxPx(
  plan: EditablePlan,
  canvasWidth: number,
  canvasHeight: number,
  rotationDeg: number = 0,
): { width: number; height: number } {
  if (!plan.metersPerPixel || plan.metersPerPixel <= 0 || plan.pixelWidth <= 0 || plan.pixelHeight <= 0) {
    const base = Math.min(canvasWidth, canvasHeight) * 0.045;
    const isRotated = rotationDeg === 90 || rotationDeg === 270;
    return isRotated
      ? { width: base * 1.5, height: base }
      : { width: base, height: base * 1.5 };
  }

  const scaleX = canvasWidth / Math.max(plan.pixelWidth, 1);
  const displayPixelsPerMeter = scaleX / plan.metersPerPixel;
  // Fator 1.9: amplia visualmente para legibilidade na tela, mantendo proporção real de 20x30cm
  const widthPx = Math.max(MIN_WIDTH_PX, SPEAKER_WIDTH_M * displayPixelsPerMeter * 1.9);
  const heightPx = Math.max(MIN_HEIGHT_PX, SPEAKER_HEIGHT_M * displayPixelsPerMeter * 1.9);

  const isRotated = rotationDeg === 90 || rotationDeg === 270;
  return isRotated
    ? { width: heightPx, height: widthPx }
    : { width: widthPx, height: heightPx };
}

export function pointInSpeakerBox(
  px: number,
  py: number,
  speaker: SpeakerDevice,
  plan: EditablePlan,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  const centerX = speaker.x * canvasWidth;
  const centerY = speaker.y * canvasHeight;
  const { width, height } = getSpeakerBoxPx(plan, canvasWidth, canvasHeight, speaker.rotationDeg);
  const hw = width / 2 + SPEAKER_HIT_MARGIN_PX;
  const hh = height / 2 + SPEAKER_HIT_MARGIN_PX;
  return Math.abs(px - centerX) <= hw && Math.abs(py - centerY) <= hh;
}

export function rotateSpeaker(speaker: SpeakerDevice): SpeakerDevice {
  return {
    ...speaker,
    rotationDeg: (speaker.rotationDeg + 90) % 360,
  };
}

export function alignSpeakers(
  reference: SpeakerDevice,
  target: SpeakerDevice,
  axis: 'horizontal' | 'vertical',
): SpeakerDevice {
  if (axis === 'horizontal') {
    return { ...target, y: reference.y };
  }

  return { ...target, x: reference.x };
}
