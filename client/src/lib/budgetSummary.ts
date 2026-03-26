import { getSavedModuleBoard } from './planState';
import { getAmpModel } from './audio/ampSelector';
import { getSpeakerModelOptionForSpeaker, getSubwooferModelBySize } from './audio/speakerModels';
import type {
  CameraProfile,
  CommercialBudgetLine,
  CommercialBudgetSection,
  EditablePlan,
  ExtraBudgetModule,
  PriceCatalogItem,
} from '../types';


function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function scoreCatalogItem(item: PriceCatalogItem, label: string, hints: string[]) {
  const name = normalizeText(item.productName);
  const sku = normalizeText(item.sku);
  const normalizedLabel = normalizeText(label);
  const normalizedHints = hints.map(normalizeText).filter(Boolean);

  let score = 0;

  if (name === normalizedLabel || sku === normalizedLabel) {
    score += 100;
  }

  if (name.includes(normalizedLabel) || normalizedLabel.includes(name)) {
    score += 40;
  }

  for (const hint of normalizedHints) {
    if (name.includes(hint)) {
      score += 10;
    }
  }

  for (const token of normalizedLabel.split(/\s+/)) {
    if (token.length >= 3 && name.includes(token)) {
      score += 3;
    }
  }

  return score;
}

function resolveCatalogMatch(label: string, catalog: PriceCatalogItem[], hints: string[] = []) {
  return catalog
    .map((item) => ({ item, score: scoreCatalogItem(item, label, hints) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item;
}

function pricedLine(
  label: string,
  quantity: number,
  unit: string,
  catalog: PriceCatalogItem[],
  hints: string[] = [],
  preferredSku?: string,
): CommercialBudgetLine {
  const normalizedPreferredSku = preferredSku?.trim().toLowerCase();
  const exactSkuMatch = normalizedPreferredSku
    ? catalog.find((item) => item.sku.trim().toLowerCase() === normalizedPreferredSku)
    : null;
  const match = exactSkuMatch ?? resolveCatalogMatch(label, catalog, hints);
  const unitPrice = match?.salePrice ?? null;

  return {
    label,
    quantity,
    unit,
    sku: match?.sku ?? null,
    unitPrice,
    totalPrice: unitPrice !== null ? Number((unitPrice * quantity).toFixed(2)) : null,
    pendingPrice: !match,
  };
}

const CAMERA_PROFILE_LABELS: Record<CameraProfile, string> = {
  '1220d': 'Camera cabeada interna',
  '1220b': 'Camera cabeada externa',
  im5: 'Camera Wi-Fi externa',
  imx: 'Camera Wi-Fi interna',
};

const CAMERA_PROFILE_HINTS: Record<CameraProfile, string[]> = {
  '1220d': ['camera', 'cabeada', 'interna', '1220d'],
  '1220b': ['camera', 'cabeada', 'externa', '1220b'],
  im5: ['camera', 'wifi', 'externa', 'im5'],
  imx: ['camera', 'wifi', 'interna', 'imx'],
};

function buildWifiSection(selectedPlans: EditablePlan[], priceCatalog: PriceCatalogItem[]): CommercialBudgetSection | null {
  const wifiPlans = selectedPlans.filter((plan) => getSavedModuleBoard(plan, 'wifi'));
  if (wifiPlans.length === 0) {
    return null;
  }

  const totalAps = wifiPlans.reduce((sum, plan) => sum + plan.accessPoints.length, 0);
  if (totalAps <= 0) {
    return null;
  }

  return {
    id: 'wifi',
    title: 'Rede Wi-Fi',
    lines: [pricedLine('Access Point UniFi U6+', totalAps, 'un', priceCatalog, ['unifi', 'ubiquiti', 'u6+', 'access point'])],
  };
}

function buildCctvSection(selectedPlans: EditablePlan[], priceCatalog: PriceCatalogItem[]): CommercialBudgetSection | null {
  const cctvPlans = selectedPlans.filter((plan) => getSavedModuleBoard(plan, 'cctv'));
  if (cctvPlans.length === 0) {
    return null;
  }

  const profileCounts: Record<CameraProfile, number> = {
    '1220d': 0,
    '1220b': 0,
    im5: 0,
    imx: 0,
  };

  cctvPlans.forEach((plan) => {
    plan.cameras.forEach((camera) => {
      profileCounts[camera.profile ?? '1220d'] += 1;
    });
  });

  const lines = (Object.keys(profileCounts) as CameraProfile[])
    .filter((profile) => profileCounts[profile] > 0)
    .map((profile) =>
      pricedLine(
        CAMERA_PROFILE_LABELS[profile],
        profileCounts[profile],
        'un',
        priceCatalog,
        CAMERA_PROFILE_HINTS[profile],
        profile,
      ),
    );

  if (lines.length === 0) {
    return null;
  }

  return {
    id: 'cctv',
    title: 'Cameras',
    lines,
  };
}

function buildAudioSections(selectedPlans: EditablePlan[], priceCatalog: PriceCatalogItem[]) {
  const audioPlans = selectedPlans.filter((plan) => getSavedModuleBoard(plan, 'audio'));

  return audioPlans.flatMap((plan) =>
    plan.audioSystems.map((system, index) => {
      const zones = plan.audioZones.filter((zone) => zone.systemId === system.id);
      const zoneIds = new Set(zones.map((zone) => zone.id));
      const systemSpeakers = plan.speakers.filter((speaker) => speaker.zoneId && zoneIds.has(speaker.zoneId));
      const counts = new Map<string, number>();

      systemSpeakers.forEach((speaker) => {
        const model =
          speaker.type === 'subwoofer'
            ? getSubwooferModelBySize(speaker.sizeInches)
            : getSpeakerModelOptionForSpeaker(speaker) ?? null;
        const label = model?.label ?? `${speaker.sizeInches}\" ${speaker.type}`;
        const key = `${label}|${model?.sku ?? ''}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });

      const ampModel = getAmpModel(system.ampType);
      const ampLabel = ampModel?.label ?? system.ampType;

      return {
        id: `audio-${plan.pageNum}-${system.id}`,
        title: `Sistema de som ${index + 1}${system.nome ? ` - ${system.nome}` : ''}`,
        lines: [
          pricedLine(
            ampLabel,
            1,
            'un',
            priceCatalog,
            [ampLabel, 'amplificador', 'receiver', 'zona', 'audio'],
            ampModel?.sku ?? undefined,
          ),
          ...Array.from(counts.entries()).map(([entry, quantity]) => {
            const [label, preferredSku] = entry.split('|');
            return pricedLine(
              label,
              quantity,
              'un',
              priceCatalog,
              [label, 'caixa de teto', 'caixa outdoor', 'subwoofer', 'audio'],
              preferredSku || undefined,
            );
          }),
        ],
      };
    }),
  );
}

export function buildBudgetSummary(params: {
  plans: Record<number, EditablePlan>;
  selectedPages: number[];
  extraBudgetModules: ExtraBudgetModule[];
  priceCatalog: PriceCatalogItem[];
}): CommercialBudgetSection[] {
  const { plans, selectedPages, extraBudgetModules, priceCatalog } = params;
  const selectedPlans = selectedPages.map((pageNum) => plans[pageNum]).filter(Boolean);
  const sections: CommercialBudgetSection[] = [];

  const wifiSection = buildWifiSection(selectedPlans, priceCatalog);
  if (wifiSection) {
    sections.push(wifiSection);
  }

  const cctvSection = buildCctvSection(selectedPlans, priceCatalog);
  if (cctvSection) {
    sections.push(cctvSection);
  }

  sections.push(...buildAudioSections(selectedPlans, priceCatalog));

  extraBudgetModules.forEach((module, index) => {
    sections.push({
      id: module.id,
      title: module.name.trim() || `Modulo extra ${index + 1}`,
      lines: module.items
        .filter((item) => item.productName.trim() && item.quantity > 0)
        .map((item) => ({
          label: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          sku: item.sku || null,
          unitPrice: item.salePrice,
          totalPrice: item.salePrice !== null ? Number((item.salePrice * item.quantity).toFixed(2)) : null,
          pendingPrice: item.salePrice === null,
        })),
    });
  });

  return sections.filter((section) => section.lines.length > 0);
}
