import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { epiasApi } from "../api";
import { useConnections } from "../connections";
import { daysAgo, slug, toOffset, today } from "../format";
import { errorMessage } from "../http";
import { FieldLookup } from "../formula";
import type {
  EndpointDetailDto,
  EndpointSummaryDto,
  FormulaDto,
  FormulaRunResult,
  FormulaSourceDto,
  FormulaValidationResult,
  ParameterDto,
  SyncResultDto,
  SyncStatus,
} from "../types";

export function useEpiasDashboard() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [chunkDays, setChunkDays] = useState(0);
  const [maxParallel, setMaxParallel] = useState(4);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<SyncResultDto[] | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await epiasApi.status());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runBulk() {
    setSyncing(true);
    setError(null);
    setResults(null);
    try {
      setResults(
        await epiasApi.syncBulk({
          startDate: toOffset(from),
          endDate: toOffset(to, true),
          chunkDays,
          maxParallel,
        }),
      );
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSyncing(false);
    }
  }

  const summary = useMemo(
    () =>
      results && {
        ok: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        inserted: results.reduce((s, r) => s + r.inserted, 0),
        duplicates: results.reduce((s, r) => s + r.duplicates, 0),
        sorted: [...results].sort((a, b) => b.inserted - a.inserted),
      },
    [results],
  );

  return {
    status,
    loading,
    error,
    dismissError: () => setError(null),
    from,
    setFrom,
    to,
    setTo,
    chunkDays,
    setChunkDays,
    maxParallel,
    setMaxParallel,
    syncing,
    runBulk,
    results,
    summary,
  };
}

// ---------------------------------------------------------------------------

export function useEndpoints(onNeedsDetail: (key: string) => void) {
  const [endpoints, setEndpoints] = useState<EndpointSummaryDto[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [includeExport, setIncludeExport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncResultDto | null>(null);
  const conn = useConnections();
  const epiasLinked = conn.epias?.linked === true;

  useEffect(() => {
    epiasApi
      .tags()
      .then(setTags)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        setEndpoints(await epiasApi.endpoints(tag, search, includeExport, signal));
      } catch (e) {
        const msg = errorMessage(e);
        if (msg) setError(msg);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [tag, search, includeExport],
  );

  // Her tuşta istek atmamak için kısa bir bekleme.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => void load(ctrl.signal), search ? 300 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [load, search]);

  async function sync(ep: EndpointSummaryDto) {
    if (ep.requiresParameters) {
      // Zorunlu ek parametreleri olan servisler detay ekranından çalıştırılır.
      onNeedsDetail(ep.key);
      return;
    }
    setSyncingKey(ep.key);
    setLastResult(null);
    try {
      setLastResult(
        await epiasApi.sync({
          endpointKey: ep.key,
          parameters: {},
          startDate: toOffset(daysAgo(7)),
          endDate: toOffset(today(), true),
          chunkDays: 0,
        }),
      );
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSyncingKey(null);
    }
  }

  function syncTitle(ep: EndpointSummaryDto) {
    if (!epiasLinked) return "Önce EPİAŞ hesabını bağlayın";
    return ep.requiresParameters ? "Parametre gerekli — detayda çalıştırın" : "Son 7 günü çek";
  }

  return {
    endpoints,
    tags,
    search,
    setSearch,
    tag,
    setTag,
    includeExport,
    setIncludeExport,
    loading,
    error,
    dismissError: () => setError(null),
    syncingKey,
    lastResult,
    dismissResult: () => setLastResult(null),
    epiasLinked,
    sync,
    syncTitle,
  };
}

export function syncResultText(r: SyncResultDto, withKey = false): string {
  const prefix = withKey ? `${r.endpointKey}: ` : "";
  if (!r.success) return prefix + (r.error ?? "Hata");
  return (
    prefix +
    `${r.fetched} satır çekildi, ${r.inserted} yeni kayıt eklendi, ${r.duplicates} kopya atlandı` +
    (withKey ? ` (${r.elapsedMs} ms).` : ` (${r.requests} istek, ${r.elapsedMs} ms).`)
  );
}

// ---------------------------------------------------------------------------

export function useEndpointDetail(key: string, pageSize = 50) {
  const [endpoint, setEndpoint] = useState<EndpointDetailDto | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [chunkDays, setChunkDays] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResultDto | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadData = useCallback(
    async (ep: EndpointDetailDto | null, p: number) => {
      if (!ep) return;
      setQuerying(true);
      try {
        const res = await epiasApi.query({ endpointKey: ep.key, page: p, pageSize, descending: true });
        setColumns(res?.columns ?? []);
        setRows(res?.rows ?? []);
        setTotal(res?.total ?? 0);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setQuerying(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    setError(null);
    setSyncResult(null);
    setPage(1);
    setParams({});
    setEndpoint(null);
    if (!key) return;
    epiasApi
      .endpoint(key)
      .then((ep) => {
        setEndpoint(ep);
        return loadData(ep, 1);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [key, loadData]);

  const editable: ParameterDto[] = useMemo(
    () =>
      endpoint?.parameters.filter(
        (p) => p.name.toLowerCase() !== "startdate" && p.name.toLowerCase() !== "enddate",
      ) ?? [],
    [endpoint],
  );

  function setParam(name: string, value: string) {
    setParams((prev) => {
      const next = { ...prev };
      if (value.trim()) next[name] = value;
      else delete next[name];
      return next;
    });
  }

  async function sync() {
    if (!endpoint) return;
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await epiasApi.sync({
        endpointKey: endpoint.key,
        parameters: params,
        startDate: endpoint.supportsDateRange ? toOffset(from) : null,
        endDate: endpoint.supportsDateRange ? toOffset(to, true) : null,
        chunkDays,
      });
      setSyncResult(res);
      if (res?.success) await loadData(endpoint, page);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSyncing(false);
    }
  }

  function goToPage(p: number) {
    const next = Math.max(1, p);
    setPage(next);
    void loadData(endpoint, next);
  }

  async function downloadCsv() {
    if (!endpoint) return;
    try {
      await epiasApi.exportCsv(endpoint.key);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return {
    endpoint,
    editable,
    params,
    setParam,
    inputType: (p: ParameterDto) => (p.type === "integer" || p.type === "number" ? "number" : "text"),
    from,
    setFrom,
    to,
    setTo,
    chunkDays,
    setChunkDays,
    syncing,
    sync,
    syncResult,
    querying,
    reload: () => loadData(endpoint, page),
    error,
    dismissError: () => setError(null),
    columns,
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    hasNext: page * pageSize < total,
    goToPage,
    downloadCsv,
  };
}

// ---------------------------------------------------------------------------

const newDto = (): FormulaDto => ({ id: 0, name: "", expression: "", alignmentMode: "DateHour", isActive: true });

export function useFormulasPage() {
  const [formulas, setFormulas] = useState<FormulaDto[] | null>(null);
  const [sources, setSources] = useState<FormulaSourceDto[] | null>(null);
  const [editing, setEditing] = useState<FormulaDto>(newDto);
  const [validation, setValidation] = useState<FormulaValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [preview, setPreview] = useState<FormulaRunResult | null>(null);
  const [runResult, setRunResult] = useState<FormulaRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outputTouched, setOutputTouched] = useState(false);
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const validateCtrl = useRef<AbortController | null>(null);
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lookup = useMemo(() => (sources ? new FieldLookup(sources) : FieldLookup.empty), [sources]);

  const load = useCallback(async () => {
    try {
      setFormulas(await epiasApi.formulas());
    } catch (e) {
      setError(errorMessage(e));
      setFormulas((f) => f ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
    epiasApi
      .formulaSources()
      .then(setSources)
      .catch((e) => {
        setError(errorMessage(e));
        setSources((s) => s ?? []);
      });
  }, [load]);

  function cancelValidation() {
    if (validateTimer.current) clearTimeout(validateTimer.current);
    validateCtrl.current?.abort();
  }

  async function validateNow(expression: string, alignmentMode: string) {
    cancelValidation();
    if (!expression.trim()) {
      setValidation(null);
      setValidating(false);
      return;
    }
    const ctrl = (validateCtrl.current = new AbortController());
    setValidating(true);
    try {
      const res = await epiasApi.validateFormula({ expression, alignmentMode }, ctrl.signal);
      if (!ctrl.signal.aborted) setValidation(res);
    } catch (e) {
      const msg = errorMessage(e);
      if (msg) setError(msg);
    } finally {
      if (!ctrl.signal.aborted) setValidating(false);
    }
  }

  /** Oluşturucudan gelen ifade değişikliği: kısa beklemeyle canlı doğrulama. */
  function setExpression(expression: string) {
    setEditing((e) => ({ ...e, expression }));
    setPreview(null);
    cancelValidation();
    if (!expression.trim()) {
      setValidation(null);
      setValidating(false);
      return;
    }
    setValidating(true);
    const mode = editing.alignmentMode;
    validateTimer.current = setTimeout(() => void validateNow(expression, mode), 400);
  }

  function setName(name: string) {
    // Kullanıcı elle yazmadıysa sonuç tablosu adı formül adından türetilir.
    setEditing((e) => ({ ...e, name, outputTable: outputTouched ? e.outputTable : slug(name) }));
  }

  function setOutputTable(outputTable: string) {
    setOutputTouched(outputTable.trim() !== "");
    setEditing((e) => ({ ...e, outputTable }));
  }

  function setAlignment(mode: string) {
    setEditing((e) => ({ ...e, alignmentMode: mode }));
    setPreview(null);
    void validateNow(editing.expression, mode);
  }

  function newFormula() {
    cancelValidation();
    setEditing(newDto());
    setValidation(null);
    setValidating(false);
    setPreview(null);
    setOutputTouched(false);
  }

  function edit(f: FormulaDto) {
    setEditing({ ...f });
    setOutputTouched(!!f.outputTable?.trim());
    setPreview(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    void validateNow(f.expression, f.alignmentMode);
  }

  async function runPreview() {
    setBusy(true);
    try {
      setPreview(
        await epiasApi.previewFormula({
          expression: editing.expression,
          alignmentMode: editing.alignmentMode,
          from: toOffset(from),
          to: toOffset(to, true),
          maxRows: 200,
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await epiasApi.saveFormula(editing);
      newFormula();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function run(f: FormulaDto) {
    setBusy(true);
    setRunResult(null);
    try {
      setRunResult(
        await epiasApi.runFormula({
          formulaId: f.id,
          from: toOffset(from),
          to: toOffset(to, true),
          persist: true,
          maxRows: 20000,
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: FormulaDto) {
    try {
      await epiasApi.deleteFormula(f.id);
      if (editing.id === f.id) newFormula();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const isValid = validation?.isValid === true;

  return {
    formulas,
    sources,
    lookup,
    editing,
    setName,
    setDescription: (description: string) => setEditing((e) => ({ ...e, description })),
    setExpression,
    setOutputTable,
    setAlignment,
    validation,
    validating,
    isValid,
    canSave: !busy && isValid && editing.name.trim() !== "",
    canPreview: !busy && isValid,
    preview,
    runResult,
    error,
    dismissError: () => setError(null),
    busy,
    from,
    setFrom,
    to,
    setTo,
    newFormula,
    edit,
    runPreview,
    save,
    run,
    remove,
  };
}

export function formulaRunText(r: FormulaRunResult): string {
  return r.error ?? `${r.name}: ${r.rows.length} satır hesaplandı, ${r.persisted} satır tabloya yazıldı (${r.elapsedMs} ms).`;
}
