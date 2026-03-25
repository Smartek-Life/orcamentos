import type { SpeakerDevice, SpeakerType } from '../../types';

export interface SpeakerModelOption {
  id: string;
  label: string;
  type: Exclude<SpeakerType, 'subwoofer'>;
  sizeInches: number;
  shortLabel: string;
}

export const SPEAKER_MODEL_OPTIONS: SpeakerModelOption[] = [
  {
    id: 'ceiling_national_6',
    label: '6 polegadas nacional',
    type: 'ceiling_national',
    sizeInches: 6,
    shortLabel: '6" nac',
  },
  {
    id: 'ceiling_national_8',
    label: '8 polegadas nacional',
    type: 'ceiling_national',
    sizeInches: 8,
    shortLabel: '8" nac',
  },
  {
    id: 'ceiling_imported_6',
    label: '6 polegadas importada',
    type: 'ceiling_imported',
    sizeInches: 6,
    shortLabel: '6" imp',
  },
  {
    id: 'ceiling_imported_8',
    label: '8 polegadas importada',
    type: 'ceiling_imported',
    sizeInches: 8,
    shortLabel: '8" imp',
  },
  {
    id: 'outdoor',
    label: 'Caixa outdoor',
    type: 'outdoor',
    sizeInches: 6,
    shortLabel: 'outdoor',
  },
];

export function getSpeakerModelOptionById(id: string) {
  return SPEAKER_MODEL_OPTIONS.find((option) => option.id === id);
}

export function getSpeakerModelOptionForSpeaker(speaker: Pick<SpeakerDevice, 'type' | 'sizeInches'>) {
  if (speaker.type === 'outdoor') {
    return getSpeakerModelOptionById('outdoor');
  }

  return SPEAKER_MODEL_OPTIONS.find(
    (option) => option.type === speaker.type && option.sizeInches === speaker.sizeInches,
  );
}

export function getSpeakerDisplayLabel(speaker: Pick<SpeakerDevice, 'type' | 'sizeInches'>) {
  if (speaker.type === 'subwoofer') {
    return 'sub';
  }

  return getSpeakerModelOptionForSpeaker(speaker)?.shortLabel ?? `${speaker.sizeInches}"`;
}
