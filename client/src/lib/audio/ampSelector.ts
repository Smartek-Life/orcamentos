import type { AmpType, AudioSystem, AudioZone } from '../../types';

export interface AmpModelOption {
  id: AmpType;
  label: string;
  zones: number;
  inputs: number;
  category: 'ceiling' | 'analog' | 'digital' | 'receiver';
  requiresSubwoofer: boolean;
  note?: string;
}

export interface AmpRecommendation {
  ampType: AmpType;
  label: string;
  reason: string;
}

export const AMP_MODEL_OPTIONS: AmpModelOption[] = [
  { id: 'ceiling_amp_1_zone', label: 'Amplificador uma zona de teto', zones: 1, inputs: 1, category: 'ceiling', requiresSubwoofer: false },
  { id: 'analog_1_zone', label: 'Amplificador uma zona analogico', zones: 1, inputs: 1, category: 'analog', requiresSubwoofer: false },
  { id: 'analog_2_zones', label: 'Amplificador duas zonas analogico', zones: 2, inputs: 2, category: 'analog', requiresSubwoofer: false },
  { id: 'analog_4_zones', label: 'Amplificador 4 zonas analogico', zones: 4, inputs: 4, category: 'analog', requiresSubwoofer: false },
  { id: 'digital_2_zones', label: 'Amp 2 zonas digital', zones: 2, inputs: 2, category: 'digital', requiresSubwoofer: false },
  { id: 'digital_4_zones', label: 'Amp 4 zonas digital', zones: 4, inputs: 4, category: 'digital', requiresSubwoofer: false },
  { id: 'digital_6_zones', label: 'Amp 6 zonas digital', zones: 6, inputs: 6, category: 'digital', requiresSubwoofer: false },
  { id: 'receiver_5_1', label: 'Receiver 5.1 - 1 zona', zones: 1, inputs: 4, category: 'receiver', requiresSubwoofer: true, note: 'Subwoofer obrigatorio.' },
  { id: 'receiver_7_1', label: 'Receiver 7.1 - duas zonas', zones: 2, inputs: 5, category: 'receiver', requiresSubwoofer: true, note: 'Subwoofer obrigatorio na zona principal.' },
];

export function getAmpModel(id: AmpType) {
  return AMP_MODEL_OPTIONS.find((option) => option.id === id);
}

function countZonesWithSubwoofer(zones: AudioZone[]) {
  return zones.filter((zone) => zone.includeSubwoofer).length;
}

export function getSystemZones(systemId: string, zones: AudioZone[]) {
  return zones.filter((zone) => zone.systemId === systemId);
}

export function selectAmplifier(zones: AudioZone[]): AmpRecommendation {
  const zoneCount = Math.max(1, zones.length);
  const totalSpeakers = zones.reduce((sum, zone) => sum + zone.speakerCount, 0);
  const subwooferZones = countZonesWithSubwoofer(zones);

  if (zoneCount === 1 && totalSpeakers <= 2 && subwooferZones === 0) {
    return {
      ampType: 'analog_1_zone',
      label: 'Amplificador uma zona analogico',
      reason: 'Projeto pequeno com uma unica zona e sem subwoofer dedicado.',
    };
  }

  if (zoneCount === 1 && subwooferZones > 0) {
    return {
      ampType: 'receiver_5_1',
      label: 'Receiver 5.1 - 1 zona',
      reason: 'Existe subwoofer na zona principal, entao o receiver 5.1 vira a leitura mais coerente.',
    };
  }

  if (zoneCount === 2 && subwooferZones > 0) {
    return {
      ampType: 'receiver_7_1',
      label: 'Receiver 7.1 - duas zonas',
      reason: 'Duas zonas com subwoofer na principal combinam melhor com receiver 7.1.',
    };
  }

  if (zoneCount === 1) {
    return {
      ampType: 'ceiling_amp_1_zone',
      label: 'Amplificador uma zona de teto',
      reason: 'Leitura direta para uma unica zona de caixas de teto.',
    };
  }

  if (zoneCount === 2) {
    return {
      ampType: 'digital_2_zones',
      label: 'Amp 2 zonas digital',
      reason: 'Duas zonas independentes pedem controle mais confortavel por aplicativo.',
    };
  }

  if (zoneCount <= 4) {
    return {
      ampType: 'digital_4_zones',
      label: 'Amp 4 zonas digital',
      reason: 'A quantidade de zonas pede distribuicao multiroom organizada.',
    };
  }

  return {
    ampType: 'digital_6_zones',
    label: 'Amp 6 zonas digital',
    reason: 'Projeto multiroom mais amplo, com varias zonas independentes.',
  };
}

export function describeAudioSystem(system: AudioSystem, allZones: AudioZone[]) {
  const zones = getSystemZones(system.id, allZones);
  const zoneCount = zones.length;
  const speakerCount = zones.reduce((sum, zone) => sum + zone.speakerCount + (zone.includeSubwoofer ? 1 : 0), 0);
  const model = getAmpModel(system.ampType);

  return {
    zoneCount,
    speakerCount,
    ampLabel: model?.label ?? system.ampType,
  };
}
