export type EnvType = 'residencial' | 'comercial';
export type WallMaterial = 'concrete' | 'brick' | 'drywall' | 'glass' | 'wood' | 'metal';
export type PlanEditorMode = 'view' | 'scale' | 'wall' | 'area';
export type ProjectModule = 'wifi' | 'audio' | 'cctv';
export type ProjectStage = 'select' | 'prepare' | 'module';
export type ModuleProgressStatus = 'idle' | 'editing' | 'saved' | 'skipped';
export type SpeakerType = 'ceiling_national' | 'ceiling_imported' | 'outdoor' | 'subwoofer';
export type AmpType =
  | 'ceiling_amp_1_zone'
  | 'analog_1_zone'
  | 'analog_2_zones'
  | 'analog_4_zones'
  | 'digital_2_zones'
  | 'digital_4_zones'
  | 'digital_6_zones'
  | 'receiver_5_1'
  | 'receiver_7_1';

export interface PdfPage {
  pageNum: number;
  thumbCanvas: HTMLCanvasElement;
  thumbDataUrl: string;
  hiResBase64: string;
  extractedText: string;
  width: number;
  height: number;
}

export interface ProjectConfig {
  envType: EnvType;
}

export interface AccessPoint {
  id: number;
  ambiente: string;
  posicao_descrita: string;
  x: number;
  y: number;
  raio_cobertura_normalizado: number;
  justificativa: string;
}

export interface CameraDevice {
  id: number;
  nome: string;
  profile: CameraProfile;
  x: number;
  y: number;
  directionDeg: number;
  fovDeg: number;
  rangeMeters: number;
}

export type CameraProfile = '1220d' | '1220b' | 'im5' | 'imx';

export interface SpeakerDevice {
  id: number;
  nome: string;
  type: SpeakerType;
  sizeInches: number;
  x: number;
  y: number;
  rotationDeg: number;
  zoneId?: string;
}

export interface AudioSystem {
  id: string;
  nome: string;
  ampType: AmpType;
  hasAudioSource: boolean;
}

export interface AudioTvPoint {
  id: string;
  systemId: string;
  x: number;
  y: number;
}

export interface AudioZone {
  id: string;
  nome: string;
  systemId?: string;
  points: PlanPoint[];
  speakerCount: number;
  includeSubwoofer: boolean;
  speakerType: Exclude<SpeakerType, 'subwoofer'>;
  speakerSizeInches: number;
}

export interface PlanPoint {
  x: number;
  y: number;
}

export interface CalibrationLine {
  start: PlanPoint;
  end: PlanPoint;
  lengthMeters: number;
}

export interface WallSegment {
  id: string;
  start: PlanPoint;
  end: PlanPoint;
  material: WallMaterial;
}

export interface SavedModuleBoard {
  savedAt: string;
  croquiDataUrl: string;
  productCount: number;
  productLabel: string;
  notes?: string;
}

export interface ModuleBoardState {
  status: ModuleProgressStatus;
  board?: SavedModuleBoard;
}

export interface PlanModuleBoards {
  wifi: ModuleBoardState;
  audio: ModuleBoardState;
  cctv: ModuleBoardState;
}

export interface EditablePlan {
  pageNum: number;
  floorLabel: string;
  baseReady: boolean;
  moduleBoards: PlanModuleBoards;
  pixelWidth: number;
  pixelHeight: number;
  mode: PlanEditorMode;
  metersPerPixel: number | null;
  calibrationLine: CalibrationLine | null;
  pendingLine: [PlanPoint, PlanPoint] | null;
  walls: WallSegment[];
  accessPoints: AccessPoint[];
  cameras: CameraDevice[];
  speakers: SpeakerDevice[];
  audioSystems: AudioSystem[];
  audioZones: AudioZone[];
  audioTvPoints: AudioTvPoint[];
  detectedAreaM2: number | null;
  dynamicCoveragePercent: number | null;
  perimeterPoints: PlanPoint[];
  calibratedAreaM2: number | null;
}

export interface FloorAnalysis {
  pageNum: number;
  area_estimada_m2: number;
  tipo_construcao: string;
  num_aps: number;
  cobertura_percentual: number;
  analise: string;
  access_points: AccessPoint[];
}

export interface AnalyzeRequest {
  pages: Array<{ pageNum: number; base64: string }>;
  config: ProjectConfig;
}

export interface AnalyzeResponse {
  results: FloorAnalysis[];
}

export interface AnalysisStateItem {
  pageNum: number;
  status: 'idle' | 'loading' | 'success' | 'error';
  pageImageBase64: string;
  error?: string;
  result?: FloorAnalysis;
}

export interface CommercialBudgetLine {
  label: string;
  quantity: number;
  unit?: string;
  unitPrice?: number | null;
  totalPrice?: number | null;
  sku?: string | null;
  pendingPrice?: boolean;
}

export interface CommercialBudgetSection {
  id: string;
  title: string;
  lines: CommercialBudgetLine[];
}

export interface PersistedProjectState {
  projectKey: string;
  fileName: string;
  fileSize: number;
  fileHash?: string;
  projectStage?: ProjectStage;
  plantsSetupSaved?: boolean;
  savedModules?: Partial<Record<ProjectModule, boolean>>;
  selectedPages: number[];
  envType: EnvType;
  selectedModule: ProjectModule;
  plans: Record<number, EditablePlan>;
  extraBudgetModules?: ExtraBudgetModule[];
  commercialBudgetSections?: CommercialBudgetSection[];
  updatedAt: string;
}

export interface PriceCatalogItem {
  id: string;
  sku: string;
  productName: string;
  category: string;
  unit: string;
  cost: number;
  markup: number;
  salePrice: number;
  active: boolean;
  metadata: Record<string, unknown>;
}

export interface ExtraBudgetItem {
  id: string;
  catalogProductId: string | null;
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  salePrice: number | null;
}

export interface ExtraBudgetModule {
  id: string;
  name: string;
  items: ExtraBudgetItem[];
}
