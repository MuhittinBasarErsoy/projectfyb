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
