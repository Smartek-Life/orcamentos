import { getAmpModel } from './audio/ampSelector';
import { getSpeakerModelOptionForSpeaker } from './audio/speakerModels';
import type { CommercialBudgetSection, EditablePlan, ProjectModule, SavedModuleBoard } from '../types';

export interface ReportBoardEntry {
  module: ProjectModule;
  floorLabel: string;
  pageNum: number;
  board: SavedModuleBoard;
  plan: EditablePlan;
}

function moduleLabel(module: ProjectModule) {
  if (module === 'wifi') return 'Rede Wi-Fi';
  if (module === 'cctv') return 'Cameras';
  return 'Sonorizacao';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Pendente';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

function buildCommercialBudgetHtml(sections: CommercialBudgetSection[]) {
  if (sections.length === 0) {
    return '';
  }

  const grandTotal = sections.reduce(
    (sum, section) =>
      sum +
      section.lines.reduce(
        (acc, line) => acc + (typeof line.totalPrice === 'number' && Number.isFinite(line.totalPrice) ? line.totalPrice : 0),
        0,
      ),
    0,
  );

  return `
    <section class="materials-group">
      <h2>Orcamento</h2>
      ${sections
        .map((section) => {
          const sectionTotal = section.lines.reduce(
            (sum, line) => sum + (typeof line.totalPrice === 'number' && Number.isFinite(line.totalPrice) ? line.totalPrice : 0),
            0,
          );

          return `
            <div class="materials-card">
              <h3>${escapeHtml(section.title)}</h3>
              <table class="materials-table">
                <thead>
                  <tr><th>Item</th><th>SKU</th><th>Qtd</th><th>Unitario</th><th>Total</th></tr>
                </thead>
                <tbody>
                  ${section.lines
                    .map(
                      (line) => `
                        <tr>
                          <td>${escapeHtml(line.label)}</td>
                          <td>${escapeHtml(line.sku ?? '-')}</td>
                          <td>${line.quantity}</td>
                          <td>${formatCurrency(line.unitPrice)}</td>
                          <td>${formatCurrency(line.totalPrice)}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
              <p class="small"><strong>Subtotal da secao:</strong> ${formatCurrency(sectionTotal)}</p>
            </div>
          `;
        })
        .join('')}
      <div class="materials-card">
        <h3>Total geral</h3>
        <p class="small-inline">${formatCurrency(grandTotal)}</p>
      </div>
    </section>
  `;
}

function buildWifiMaterials(savedBoards: ReportBoardEntry[]) {
  const wifiBoards = savedBoards.filter((entry) => entry.module === 'wifi');
  if (wifiBoards.length === 0) {
    return '';
  }

  const totalAps = wifiBoards.reduce((sum, { plan }) => sum + plan.accessPoints.length, 0);

  return `
    <section class="materials-group">
      <h2>Rede Wi-Fi</h2>
      <div class="materials-card">
        <h3>Casa toda</h3>
        <table class="materials-table">
          <thead><tr><th>Item</th><th>Quantidade</th></tr></thead>
          <tbody>
            <tr><td>Access Point UniFi U6+</td><td>${totalAps}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function buildCctvMaterials(savedBoards: ReportBoardEntry[]) {
  const cctvBoards = savedBoards.filter((entry) => entry.module === 'cctv');
  if (cctvBoards.length === 0) {
    return '';
  }

  const totalCameras = cctvBoards.reduce((sum, { plan }) => sum + plan.cameras.length, 0);

  return `
    <section class="materials-group">
      <h2>Cameras</h2>
      <div class="materials-card">
        <h3>Casa toda</h3>
        <table class="materials-table">
          <thead><tr><th>Item</th><th>Quantidade</th></tr></thead>
          <tbody>
            <tr><td>Camera</td><td>${totalCameras}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function buildAudioMaterials(savedBoards: ReportBoardEntry[]) {
  const audioBoards = savedBoards.filter((entry) => entry.module === 'audio');
  if (audioBoards.length === 0) {
    return '';
  }

  return `
    <section class="materials-group">
      <h2>Sonorizacao</h2>
      ${audioBoards
        .flatMap(({ plan }) =>
          plan.audioSystems.map((system) => {
            const zones = plan.audioZones.filter((zone) => zone.systemId === system.id);
            const zoneIds = new Set(zones.map((zone) => zone.id));
            const speakers = plan.speakers.filter((speaker) => speaker.zoneId && zoneIds.has(speaker.zoneId));
            const modelCounts = new Map<string, number>();

            speakers.forEach((speaker) => {
              const label =
                speaker.type === 'subwoofer'
                  ? `Subwoofer ${speaker.sizeInches}"`
                  : getSpeakerModelOptionForSpeaker(speaker)?.label ?? `${speaker.sizeInches}" ${speaker.type}`;
              modelCounts.set(label, (modelCounts.get(label) ?? 0) + 1);
            });

            return {
              systemName: system.nome,
              ampLabel: getAmpModel(system.ampType)?.label ?? system.ampType,
              modelCounts,
            };
          }),
        )
        .map(
          ({ systemName, ampLabel, modelCounts }, index) => `
            <div class="materials-card">
              <h3>Sistema de som ${index + 1}${systemName ? ` - ${escapeHtml(systemName)}` : ''}</h3>
              <table class="materials-table">
                <thead><tr><th>Item</th><th>Quantidade</th></tr></thead>
                <tbody>
                  <tr><td>${escapeHtml(ampLabel)}</td><td>1</td></tr>
                  ${Array.from(modelCounts.entries())
                    .map(([label, qty]) => `<tr><td>${escapeHtml(label)}</td><td>${qty}</td></tr>`)
                    .join('')}
                </tbody>
              </table>
            </div>
          `,
        )
        .join('')}
    </section>
  `;
}

export function buildProjectReportHtml(params: {
  preparedPlantsCount: number;
  savedBoards: ReportBoardEntry[];
  commercialBudgetSections?: CommercialBudgetSection[];
}) {
  const { preparedPlantsCount, savedBoards, commercialBudgetSections = [] } = params;
  const materialsHtml =
    commercialBudgetSections.length > 0
      ? buildCommercialBudgetHtml(commercialBudgetSections)
      : [buildWifiMaterials(savedBoards), buildCctvMaterials(savedBoards), buildAudioMaterials(savedBoards)]
          .filter(Boolean)
          .join('');

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Relatorio do Projeto</title>
    <style>
      @page { size: A4; margin: 14mm; }
      body { font-family: Arial, sans-serif; margin: 0; color: #10243A; }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      .page-inner { padding: 0; }
      h1, h2, h3 { margin: 0 0 12px; }
      .meta { margin-bottom: 24px; color: #4b6078; }
      .board { page-break-inside: avoid; border: 1px solid #d8e0ea; border-radius: 16px; padding: 16px; }
      .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #e8f1fb; color: #185FA5; font-weight: 700; font-size: 12px; margin-bottom: 10px; }
      .materials-group { margin-bottom: 24px; }
      .materials-card { border: 1px solid #d8e0ea; border-radius: 16px; padding: 14px; margin-top: 12px; }
      .materials-card.nested { border-color: #e7edf4; background: #fbfcfe; }
      .materials-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      .materials-table th, .materials-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e8edf3; font-size: 13px; }
      .materials-table th { color: #4b6078; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
      .small-inline { color: #5a7089; font-size: 12px; font-weight: 400; }
      img { width: 100%; border-radius: 12px; border: 1px solid #d8e0ea; }
      .small { color: #5a7089; font-size: 12px; margin-top: 8px; }
    </style>
  </head>
  <body>
    <section class="page">
      <div class="page-inner">
        <h1>Relatorio do Projeto</h1>
        <p class="meta">Plantas preparadas: ${preparedPlantsCount} | Pranchas salvas: ${savedBoards.length}</p>
      </div>
    </section>
    ${
      materialsHtml
        ? `<section class="page">
            <div class="page-inner">
              <h1>Lista de Materiais</h1>
              ${materialsHtml}
            </div>
          </section>`
        : ''
    }
    ${savedBoards
      .map(
        ({ module, floorLabel, pageNum, board }) => `
          <section class="page">
            <div class="page-inner board">
              <div class="badge">${moduleLabel(module)}</div>
              <h2>${floorLabel}</h2>
              <p class="small">Pagina ${pageNum} | ${board.productCount} ${board.productLabel} | salvo em ${new Date(board.savedAt).toLocaleString('pt-BR')}</p>
              ${board.notes ? `<p class="small">${board.notes}</p>` : ''}
              <img src="${board.croquiDataUrl}" alt="Croqui ${floorLabel}" />
            </div>
          </section>
        `,
      )
      .join('')}
  </body>
</html>`;
}
