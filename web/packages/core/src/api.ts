import { auth } from "./auth";
import { http } from "./http";
import type {
  AuthResponse,
  BulkSyncRequest,
  EndpointDetailDto,
  EndpointSummaryDto,
  ExternalAccountStatus,
  FormulaDto,
  FormulaPreviewRequest,
  FormulaRunRequest,
  FormulaRunResult,
  FormulaSourceDto,
  FormulaValidationResult,
  JobDto,
  LinkResponse,
  MeDto,
  OsosResult,
  PagedResult,
  ProfileResponse,
  RunNowRequest,
  ScheduleJobRequest,
  SearchHistoryDto,
  SearchResultDto,
  SyncRequest,
  SyncResultDto,
  SyncStatus,
  TableQueryRequest,
  TableQueryResult,
  WeatherJobRequest,
  WeatherQuery,
} from "./types";

import type {
  CustomerDto,
  CustomerListItem,
  CustomerOsosKind,
  CustomerOsosResult,
  CustomerSaveRequest,
  CustomerSummaryDto,
  CustomerUserDto,
  DocumentDto,
  DocumentUpload,
  InstallationDto,
  InstallationSaveRequest,
  OsosConnectionDto,
  OsosConnectionSaveRequest,
  OsosSubscriptionDto,
  OsosSyncResult,
  ParameterGroupDto,
  ParameterValueDto,
  ParameterValueSaveRequest,
} from "./customerTypes";

const enc = encodeURIComponent;

export const authApi = {
  async login(username: string, password: string) {
    const res = await http.post<AuthResponse>("api/auth/login", { username, password });
    auth.signIn(res.token, res.username);
  },
  async register(username: string, email: string, password: string) {
    const res = await http.post<AuthResponse>("api/auth/register", { username, email, password });
    auth.signIn(res.token, res.username);
  },
  profile: () => http.get<ProfileResponse>("api/auth/me"),
};

export const accountsApi = {
  ososStatus: () => http.get<ExternalAccountStatus>("api/osos/status"),
  epiasStatus: () => http.get<ExternalAccountStatus>("api/epias/status"),
  linkOsos: (username: string, password: string) =>
    http.post<LinkResponse>("api/osos/link", { ososUserCode: username, ososPassword: password, rememberMe: true }),
  linkEpias: (username: string, password: string) =>
    http.post<LinkResponse>("api/epias/link", { username, password }),
  unlinkOsos: () => http.del("api/osos/link"),
  unlinkEpias: () => http.del("api/epias/link"),
};

export interface OsosDateQuery {
  startDate: string;
  endDate: string;
  selected?: number[];
}

export const ososApi = {
  me: () => http.get<MeDto>("api/osos/me"),
  consumption: (q: OsosDateQuery & { type: number }) => http.post<OsosResult>("api/osos/consumption", q),
  endex: (q: OsosDateQuery) => http.post<OsosResult>("api/osos/endex", q),
  profiles: (q: OsosDateQuery) => http.post<OsosResult>("api/osos/profiles", q),
  subscriptions: () => http.post<OsosResult>("api/osos/subscriptions", {}),
  ownerConsumptions: (q: { ownerSerno: number; startDate: string; endDate: string }) =>
    http.post<OsosResult>("api/osos/dashboard/owner-consumptions", q),

  weather: (q: WeatherQuery) => http.post<OsosResult>("api/weather", q),

  history: (page = 1, pageSize = 25) =>
    http.get<PagedResult<SearchHistoryDto>>(`api/searches?page=${page}&pageSize=${pageSize}`),
  snapshot: (id: number) => http.get<SearchResultDto>(`api/searches/${id}`),
  rerun: (id: number) => http.post<OsosResult>(`api/searches/${id}/rerun`),
  deleteSearch: (id: number) => http.del(`api/searches/${id}`),
  exportCsv: (id: number) => http.download(`api/searches/${id}/export`, `arama_${id}.csv`),

  runNow: (req: RunNowRequest) => http.post<unknown>("api/jobs/run-now", req),
  schedule: (req: ScheduleJobRequest) => http.post<unknown>("api/jobs/schedule", req),
  weatherRunNow: (req: WeatherJobRequest) => http.post<unknown>("api/jobs/weather/run-now", req),
  weatherSchedule: (req: WeatherJobRequest) => http.post<unknown>("api/jobs/weather/schedule", req),
  jobs: () => http.get<JobDto[]>("api/jobs"),
  triggerJob: (id: string) => http.post<unknown>(`api/jobs/${enc(id)}/trigger`),
  deleteJob: (id: string) => http.del(`api/jobs/${enc(id)}`),
};

export const epiasApi = {
  endpoints(tag?: string, search?: string, includeExport = false, signal?: AbortSignal) {
    const q = new URLSearchParams();
    if (tag) q.set("tag", tag);
    if (search) q.set("search", search);
    q.set("includeExport", String(includeExport));
    return http.get<EndpointSummaryDto[]>(`api/epias/catalog/endpoints?${q}`, signal);
  },
  tags: () => http.get<string[]>("api/epias/catalog/tags"),
  endpoint: (key: string) => http.get<EndpointDetailDto>(`api/epias/catalog/endpoints/${enc(key)}`),

  sync: (req: SyncRequest) => http.postAllowingResultErrors<SyncResultDto>("api/epias/sync/run", req),
  syncBulk: (req: BulkSyncRequest) => http.post<SyncResultDto[]>("api/epias/sync/run-bulk", req),
  status: () => http.get<SyncStatus>("api/epias/sync/status"),

  query: (req: TableQueryRequest) => http.post<TableQueryResult>("api/epias/data/query", req),
  exportCsv(key: string, from?: string | null, to?: string | null) {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const suffix = q.toString() ? `?${q}` : "";
    return http.download(`api/epias/data/${enc(key)}/csv${suffix}`, `${key}.csv`);
  },

  formulas: () => http.get<FormulaDto[]>("api/epias/formulas"),
  formulaSources: () => http.get<FormulaSourceDto[]>("api/epias/formulas/sources"),
  validateFormula: (req: FormulaPreviewRequest, signal?: AbortSignal) =>
    http.postAllowingResultErrors<FormulaValidationResult>("api/epias/formulas/validate", req, signal),
  previewFormula: (req: FormulaPreviewRequest) =>
    http.postAllowingResultErrors<FormulaRunResult>("api/epias/formulas/preview", req),
  saveFormula: (dto: FormulaDto) => http.post<FormulaDto>("api/epias/formulas", dto),
  runFormula: (req: FormulaRunRequest) =>
    http.postAllowingResultErrors<FormulaRunResult>("api/epias/formulas/run", req),
  deleteFormula: (id: number) => http.del(`api/epias/formulas/${id}`),
};

// ---- Müşteri modülü ----

export const customersApi = {
  list: (search = "", includeInactive = false) =>
    http.get<CustomerListItem[]>(`api/customers?search=${enc(search)}&includeInactive=${includeInactive}`),
  get: (id: number) => http.get<CustomerDto>(`api/customers/${id}`),
  summary: (id: number) => http.get<CustomerSummaryDto>(`api/customers/${id}/summary`),
  create: (req: CustomerSaveRequest) => http.post<CustomerDto>("api/customers", req),
  update: (id: number, req: CustomerSaveRequest) => http.put<CustomerDto>(`api/customers/${id}`, req),

  osos: (id: number, kind: CustomerOsosKind, q: { startDate: string; endDate: string; installationId?: number | null; type?: number }) =>
    http.post<CustomerOsosResult>(`api/customers/${id}/osos/${kind}`, q),

  users: (id: number) => http.get<CustomerUserDto[]>(`api/customers/${id}/users`),
  createUser: (id: number, req: { username: string; email?: string | null; password: string }) =>
    http.post<CustomerUserDto>(`api/customers/${id}/users`, req),
  deleteUser: (id: number, userId: string) => http.del(`api/customers/${id}/users/${enc(userId)}`),

  installations: (id: number, includeInactive = false) =>
    http.get<InstallationDto[]>(`api/customers/${id}/installations?includeInactive=${includeInactive}`),
  createInstallation: (id: number, req: InstallationSaveRequest) =>
    http.post<InstallationDto>(`api/customers/${id}/installations`, req),
  updateInstallation: (installationId: number, req: InstallationSaveRequest) =>
    http.put<InstallationDto>(`api/installations/${installationId}`, req),

  connections: (id: number) => http.get<OsosConnectionDto[]>(`api/customers/${id}/osos-connections`),
  createConnection: (id: number, req: OsosConnectionSaveRequest) =>
    http.post<OsosConnectionDto>(`api/customers/${id}/osos-connections`, req),
  updateConnection: (connectionId: number, req: OsosConnectionSaveRequest) =>
    http.put<OsosConnectionDto>(`api/osos-connections/${connectionId}`, req),
  testConnection: (connectionId: number) => http.post<LinkResponse>(`api/osos-connections/${connectionId}/test`),
  syncConnection: (connectionId: number) => http.post<OsosSyncResult>(`api/osos-connections/${connectionId}/sync`),

  subscriptions: (id: number, includeInactive = false) =>
    http.get<OsosSubscriptionDto[]>(`api/customers/${id}/osos-subscriptions?includeInactive=${includeInactive}`),
  linkSubscription: (subscriptionId: number, installationId: number | null) =>
    http.put<OsosSubscriptionDto>(`api/osos-subscriptions/${subscriptionId}/installation`, { installationId }),
  createInstallationFromSubscription: (subscriptionId: number) =>
    http.post<OsosSubscriptionDto>(`api/osos-subscriptions/${subscriptionId}/create-installation`),

  documents: (id: number, opts: { documentTypeId?: number | null; installationId?: number | null; includeInactive?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (opts.documentTypeId) q.set("documentTypeId", String(opts.documentTypeId));
    if (opts.installationId) q.set("installationId", String(opts.installationId));
    if (opts.includeInactive) q.set("includeInactive", "true");
    return http.get<DocumentDto[]>(`api/customers/${id}/documents?${q}`);
  },
  uploadDocument: (id: number, d: DocumentUpload) => {
    const f = new FormData();
    f.set("file", d.file);
    f.set("documentTypeId", String(d.documentTypeId));
    const opt: Record<string, unknown> = {
      installationId: d.installationId, title: d.title, documentDate: d.documentDate, periodYear: d.periodYear,
      periodMonth: d.periodMonth, expiryDate: d.expiryDate, description: d.description,
    };
    for (const [k, v] of Object.entries(opt)) if (v !== undefined && v !== null && v !== "") f.set(k, String(v));
    return http.upload<{ id: number }>(`api/customers/${id}/documents`, f);
  },
  downloadDocument: (doc: { id: number; fileName: string }) => http.download(`api/documents/${doc.id}/download`, doc.fileName),
  deleteDocument: (documentId: number) => http.del(`api/documents/${documentId}`),
  restoreDocument: (documentId: number) => http.post<void>(`api/documents/${documentId}/restore`),
};

export const parametersApi = {
  list: (includeInactive = false) => http.get<ParameterGroupDto[]>(`api/parameters?includeInactive=${includeInactive}`),
  createValue: (groupId: number, req: ParameterValueSaveRequest) =>
    http.post<ParameterValueDto>(`api/parameters/groups/${groupId}/values`, req),
  updateValue: (valueId: number, req: ParameterValueSaveRequest) =>
    http.put<ParameterValueDto>(`api/parameters/values/${valueId}`, req),
  createGroup: (req: { code: string; name: string; isActive: boolean }) =>
    http.post<ParameterGroupDto>("api/parameters/groups", req),
};

export const mailApi = {
  status: () => http.get<{ enabled: boolean }>("api/mail/status"),
  test: (to: string) => http.post<LinkResponse>("api/mail/test", { to }),
};
