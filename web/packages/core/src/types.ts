// Sunucu sözleşmelerinin (FyBlue.Contracts, Osos.Contracts, Epias.Contracts) TypeScript karşılıkları.
// ASP.NET JSON'u camelCase yazar; tarihler ISO metni olarak gelir.

// ---- Uygulama kimliği ----

export interface AuthResponse {
  token: string;
  expiresAt: string;
  username: string;
}

export interface ProfileResponse {
  username: string;
  email?: string | null;
  createdAt: string;
}

export interface ExternalAccountStatus {
  linked: boolean;
  username?: string | null;
  updatedAt?: string | null;
}

export interface LinkResponse {
  success: boolean;
  message?: string | null;
}

export type ExternalSystem = "osos" | "epias";

// ---- OSOS ----

export type OsosScreen = "Consumption" | "Endex" | "Profiles" | "Subscriptions" | "Dashboard";
export type JobScreen = OsosScreen | "Weather";

export interface MeDto {
  serno: number;
  subscriptions: unknown;
}

export interface OsosResult {
  rawJson: string;
  rowCount: number;
  searchHistoryId: number;
}

export interface SearchHistoryDto {
  id: number;
  screen: string;
  methodName: string;
  parametersJson: string;
  serno?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  rowCount?: number | null;
  createdAt: string;
}

export interface SearchResultDto {
  searchHistoryId: number;
  resultJson: string;
  rowCount: number;
  capturedAt: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JobDto {
  id: string;
  screen: string;
  serno: number;
  daysBack: number;
  cron: string;
  nextRun?: string | null;
  lastRun?: string | null;
  lastState?: string | null;
}

export interface RunNowRequest {
  screen: string;
  serno: number;
  daysBack: number;
  type: number;
}

export interface ScheduleJobRequest extends RunNowRequest {
  cron: string;
  name?: string | null;
}

export interface WeatherJobRequest {
  latitude: number;
  longitude: number;
  daysBack: number;
  timezone: string;
  tilt?: number | null;
  azimuth?: number | null;
  cron?: string | null;
  name?: string | null;
}

export interface WeatherQuery {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  timezone: string;
  tilt?: number | null;
  azimuth?: number | null;
}

// ---- EPİAŞ ----

export interface EndpointSummaryDto {
  key: string;
  path: string;
  method: string;
  tag: string;
  title: string;
  tableName: string;
  isExport: boolean;
  supportsDateRange: boolean;
  requiresParameters: boolean;
  rowCount: number;
  lastSyncedAt?: string | null;
}

export interface ParameterDto {
  name: string;
  type: string;
  required: boolean;
  description?: string | null;
  example?: string | null;
  in: string;
  enumValues?: string[] | null;
}

export interface ColumnDto {
  name: string;
  sqlType: string;
  clrType: string;
  isNumeric: boolean;
  isDate: boolean;
  description?: string | null;
}

export interface EndpointDetailDto extends EndpointSummaryDto {
  description?: string | null;
  parameters: ParameterDto[];
  columns: ColumnDto[];
}

export interface SyncRequest {
  endpointKey: string;
  parameters: Record<string, unknown>;
  startDate?: string | null;
  endDate?: string | null;
  chunkDays: number;
}

export interface SyncResultDto {
  endpointKey: string;
  tableName: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  requests: number;
  elapsedMs: number;
  success: boolean;
  error?: string | null;
}

export interface BulkSyncRequest {
  endpointKeys?: string[];
  startDate?: string | null;
  endDate?: string | null;
  chunkDays: number;
  maxParallel: number;
  tagFilter?: string | null;
}

export interface SyncStatus {
  totalOperations: number;
  dataEndpoints: number;
  syncedEndpoints: number;
  exportEndpoints: number;
}

export interface TableQueryRequest {
  endpointKey: string;
  from?: string | null;
  to?: string | null;
  page: number;
  pageSize: number;
  orderBy?: string | null;
  descending: boolean;
}

export interface TableQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

export type AlignmentMode = "DateHour" | "Date" | "None";

export interface FormulaDto {
  id: number;
  name: string;
  description?: string | null;
  expression: string;
  alignmentMode: AlignmentMode | string;
  outputTable?: string | null;
  defaultFrom?: string | null;
  defaultTo?: string | null;
  isActive: boolean;
  createdAt?: string;
  createdBy?: string | null;
}

export interface FormulaValidationResult {
  isValid: boolean;
  error?: string | null;
  referencedTables: string[];
  referencedColumns: string[];
  generatedSql?: string | null;
}

export interface FormulaRowDto {
  date?: string | null;
  hour?: string | null;
  value?: number | null;
}

export interface FormulaRunResult {
  formulaId: number;
  name: string;
  rows: FormulaRowDto[];
  persisted: number;
  elapsedMs: number;
  sql?: string | null;
  error?: string | null;
}

export interface FormulaRunRequest {
  formulaId: number;
  from?: string | null;
  to?: string | null;
  persist: boolean;
  maxRows: number;
}

export interface FormulaPreviewRequest {
  expression: string;
  alignmentMode: string;
  from?: string | null;
  to?: string | null;
  maxRows?: number;
}

export interface FormulaSourceFieldDto {
  column: string;
  label: string;
}

export interface FormulaSourceDto {
  key: string;
  title: string;
  tag: string;
  tableName: string;
  rowCount: number;
  hasDate: boolean;
  hasHour: boolean;
  fields: FormulaSourceFieldDto[];
}
