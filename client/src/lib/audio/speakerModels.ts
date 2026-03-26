import type { SpeakerDevice, SpeakerType } from '../../types';

export interface SpeakerModelOption {
  id: string;
  label: string;
  type: Exclude<SpeakerType, 'subwoofer'>;
  sizeInches: number;
  shortLabel: string;
  sku: string;
}

export const SPEAKER_MODEL_OPTIONS: SpeakerModelOption[] = [
  {
    id: 'ceiling_national_6',
    label: 'CI6R',
    type: 'ceiling_national',
    sizeInches: 6,
    shortLabel: 'CI6R',
    sku: 'CI6R',
  },
  {
    id: 'ceiling_national_8',
    label: 'CI8R',
    type: 'ceiling_national',
    sizeInches: 8,
    shortLabel: 'CI8R',
    sku: 'CI8R',
  },
  {
    id: 'ceiling_imported_6',
    label: 'JBL 260W',
    type: 'ceiling_imported',
    sizeInches: 6,
    shortLabel: 'JBL260',
    sku: 'JBL 260W',
  },
  {
    id: 'ceiling_imported_8',
    label: 'JBL 280W',
    type: 'ceiling_imported',
    sizeInches: 8,
    shortLabel: 'JBL280',
    sku: 'JBL 280W',
  },
  {
    id: 'outdoor',
    label: 'OS120',
    type: 'outdoor',
    sizeInches: 6,
    shortLabel: 'OS120',
    sku: 'OS120',
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

export function getSubwooferModelBySize(sizeInches: number) {
  if (sizeInches >= 12) {
    return { label: 'A220P', sku: 'A220P', shortLabel: 'A220P' };
  }
  if (sizeInches >= 10) {
    return { label: 'A200P', sku: 'A200P', shortLabel: 'A200P' };
  }
  return { label: 'CI8P', sku: 'CI8P', shortLabel: 'CI8P' };
}
