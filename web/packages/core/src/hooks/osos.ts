import { useCallback, useEffect, useMemo, useState } from "react";
import { epiasApi, ososApi } from "../api";
import { connections } from "../connections";
import { daysAgo, today } from "../format";
import { errorMessage } from "../http";
import { buildSeries, chartColumns, parseResult } from "../results";
import { filterSubscriptions, parseSubscriptions, subscriptionText, type SubscriptionItem } from "../subscriptions";
import type {
  JobDto,
  OsosResult,
  OsosScreen,
  PagedResult,
  SearchHistoryDto,
  SearchResultDto,
  SyncStatus,
  WeatherJobRequest,
} from "../types";
import type { Notice } from "./auth";

function useSubscriptions(enabled = true) {
  const [subs, setSubs] = useState<SubscriptionItem[]>([]);
  useEffect(() => {
    if (!enabled) return;
    ososApi
      .me()
      .then((me) => setSubs(parseSubscriptions(me?.subscriptions)))
      .catch(() => {
        /* abone listesi isteğe bağlı; hesap bağlı değilse sayfa zaten uyarır */
      });
  }, [enabled]);
  return subs;
}

/**
 * Aranabilir tesisat seçici (combobox) durumu. value=0 → "Otomatik (tüm tesisatlar)".
 * Liste tamamı gösterilmez; yazdıkça ünvan/abone no/Serno ile filtrelenir (en çok 50).
 */
export function useSubscriptionPicker(subs: SubscriptionItem[], value: number, onChange: (serno: number) => void) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = subs.find((s) => s.serno === value) ?? null;
  const results = useMemo(() => filterSubscriptions(subs, query), [subs, query]);
  const matchCount = useMemo(() => (query.trim() ? filterSubscriptions(subs, query, Infinity).length : subs.length), [subs, query]);

  function pick(serno: number) {
    onChange(serno);
    setQuery("");
    setOpen(false);
  }

  return {
    query,
    setQuery: (q: string) => {
      setQuery(q);
      setOpen(true);
    },
    open,
    setOpen,
    results,
    /** Filtreye uyan toplam kayıt (listede en çok 50 gösterilir). */
    matchCount,
    total: subs.length,
    selectedText: value === 0 ? AUTO_SUBSCRIPTION_TEXT : selected ? subscriptionText(selected) : `#${value}`,
    pick,
    text: subscriptionText,
  };
}

export const AUTO_SUBSCRIPTION_TEXT = "Otomatik (tüm tesisatlar)";

/** Tablo/grafik görünümü için ham JSON'u çözer ve grafik sütun seçimini tutar. */
export function useResultView(json: string | null | undefined) {
  const table = useMemo(() => parseResult(json), [json]);
  const cols = useMemo(
    () => (table ? chartColumns(table) : { numeric: [], labels: [], defaultLabel: "" }),
    [table],
  );
  const [valueCol, setValueCol] = useState("");
  const [labelCol, setLabelCol] = useState<string | null>(null);

  const effectiveValue = cols.numeric.includes(valueCol) ? valueCol : (cols.numeric[0] ?? "");
  const effectiveLabel = labelCol ?? cols.defaultLabel;
  const series = useMemo(
    () => (table && effectiveValue ? buildSeries(table, effectiveValue, effectiveLabel) : []),
    [table, effectiveValue, effectiveLabel],
  );

  return {
    table,
    numericColumns: cols.numeric,
    labelColumns: cols.labels,
    valueCol: effectiveValue,
    setValueCol,
    labelCol: effectiveLabel,
    setLabelCol,
    series,
  };
}

export type ResultViewMode = "table" | "chart";

// ---------------------------------------------------------------------------

export function useOverview() {
  const [recent, setRecent] = useState<SearchHistoryDto[] | null>(null);
  const [ososError, setOsosError] = useState<string | null>(null);
  const [stats, setStats] = useState<SyncStatus | null>(null);
  const [epiasError, setEpiasError] = useState<string | null>(null);

  useEffect(() => {
    ososApi
      .history(1, 5)
      .then((p) => setRecent(p?.items ?? []))
      .catch((e) => setOsosError(errorMessage(e)));
    epiasApi
      .status()
      .then(setStats)
      .catch((e) => setEpiasError(errorMessage(e)));
  }, []);

  return { recent, ososError, stats, epiasError };
}

// ---------------------------------------------------------------------------

export function useOsosQuery() {
  const [screen, setScreen] = useState<OsosScreen>("Consumption");
  const [ownerSerno, setOwnerSerno] = useState(0);
  const [start, setStart] = useState(daysAgo(7));
  const [end, setEnd] = useState(today());
  const [type, setType] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OsosResult | null>(null);
  const [view, setView] = useState<ResultViewMode>("table");
  const [selected, setSelected] = useState<number[]>([]);
  const [subsQuery, setSubsQuery] = useState("");
  const subs = useSubscriptions();
  const visibleSubs = useMemo(() => filterSubscriptions(subs, subsQuery, Infinity), [subs, subsQuery]);

  const toggle = (serno: number, on: boolean) =>
    setSelected((prev) => (on ? [...new Set([...prev, serno])] : prev.filter((s) => s !== serno)));

  const usesDates = screen !== "Subscriptions";
  const usesFilter = (screen === "Consumption" || screen === "Endex" || screen === "Profiles") && subs.length > 0;

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    setView("table");
    try {
      const base = { startDate: start, endDate: end, selected };
      const res =
        screen === "Consumption"
          ? await ososApi.consumption({ ...base, type })
          : screen === "Endex"
            ? await ososApi.endex(base)
            : screen === "Profiles"
              ? await ososApi.profiles(base)
              : screen === "Subscriptions"
                ? await ososApi.subscriptions()
                : await ososApi.ownerConsumptions({ ownerSerno, startDate: start, endDate: end });
      setResult(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function download(id: number) {
    try {
      await ososApi.exportCsv(id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return {
    screen,
    setScreen,
    ownerSerno,
    setOwnerSerno,
    start,
    setStart,
    end,
    setEnd,
    type,
    setType,
    subs,
    /** Tesisat filtresindeki arama metni ve ona uyan tesisatlar. */
    subsQuery,
    setSubsQuery,
    visibleSubs,
    selected,
    toggle,
    usesDates,
    usesFilter,
    busy,
    error,
    result,
    view,
    setView,
    run,
    download,
  };
}

// ---------------------------------------------------------------------------

export function useHistory(pageSize = 25) {
  const [page, setPage] = useState<PagedResult<SearchHistoryDto> | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [snapshot, setSnapshot] = useState<SearchResultDto | null>(null);
  const [viewId, setViewId] = useState(0);
  const [view, setView] = useState<ResultViewMode>("table");

  const load = useCallback(
    async (p = pageNo) => {
      setLoading(true);
      try {
        setPage(await ososApi.history(p, pageSize));
      } catch (e) {
        setNotice({ ok: false, text: errorMessage(e) });
      } finally {
        setLoading(false);
      }
    },
    [pageNo, pageSize],
  );

  useEffect(() => {
    void load(pageNo);
  }, [pageNo]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageCount = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;

  async function open(id: number) {
    try {
      setSnapshot(await ososApi.snapshot(id));
      setViewId(id);
      setView("table");
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }

  async function rerun(id: number) {
    setNotice({ ok: true, text: "Tekrar çalıştırılıyor…" });
    try {
      const res = await ososApi.rerun(id);
      setNotice({
        ok: true,
        text: `Tekrar çalıştı: ${res?.rowCount ?? 0} satır, yeni kayıt #${res?.searchHistoryId}.`,
      });
      if (pageNo === 1) await load(1);
      else setPageNo(1);
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }

  async function remove(id: number) {
    try {
      await ososApi.deleteSearch(id);
      if (viewId === id) setSnapshot(null);
      await load();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }

  async function download(id: number) {
    try {
      await ososApi.exportCsv(id);
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }

  return {
    page,
    pageNo,
    pageCount,
    setPageNo,
    loading,
    reload: () => load(),
    notice,
    dismissNotice: () => setNotice(null),
    snapshot,
    viewId,
    closeSnapshot: () => setSnapshot(null),
    view,
    setView,
    open,
    rerun,
    remove,
    download,
  };
}

// ---------------------------------------------------------------------------

export function useJobs() {
  const [screen, setScreen] = useState("Consumption");
  const [serno, setSerno] = useState(0);
  const [daysBack, setDaysBack] = useState(2);
  const [type, setType] = useState(2);
  const [cronPreset, setCronPreset] = useState("");
  const [customCron, setCustomCron] = useState("");
  const [name, setName] = useState("");
  const [notifyEmails, setNotifyEmails] = useState("");
  const [lat, setLat] = useState(40.195);
  const [lon, setLon] = useState(29.06);
  const [tz, setTz] = useState("Europe/Istanbul");
  const [tilt, setTilt] = useState<number | null>(null);
  const [azimuth, setAzimuth] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [jobs, setJobs] = useState<JobDto[] | null>(null);
  const [ososLinked, setOsosLinked] = useState<boolean | null>(null);
  const subs = useSubscriptions(ososLinked === true);

  const effectiveCron = cronPreset === "custom" ? customCron.trim() : cronPreset;
  const isWeather = screen === "Weather";

  const load = useCallback(async () => {
    try {
      setJobs((await ososApi.jobs()) ?? []);
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
      setJobs((j) => j ?? []);
    }
  }, []);

  useEffect(() => {
    connections.ensureLoaded().then(() => setOsosLinked(connections.get().osos?.linked === true));
    void load();
  }, [load]);

  const weatherReq = (cron: string | null): WeatherJobRequest => ({
    latitude: lat,
    longitude: lon,
    daysBack,
    timezone: tz,
    tilt,
    azimuth,
    cron,
    name: name || null,
  });

  async function runNow() {
    setBusy(true);
    setNotice(null);
    try {
      if (isWeather) await ososApi.weatherRunNow(weatherReq(null));
      else await ososApi.runNow({ screen, serno, daysBack, type, notifyEmails: notifyEmails.trim() || null });
      setNotice({ ok: true, text: "İş kuyruğa alındı — birkaç saniye içinde çalışır ve Geçmiş'te görünür." });
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function schedule() {
    setBusy(true);
    setNotice(null);
    try {
      if (isWeather) await ososApi.weatherSchedule(weatherReq(effectiveCron));
      else
        await ososApi.schedule({
          screen,
          serno,
          daysBack,
          type,
          cron: effectiveCron,
          name: name || null,
          notifyEmails: notifyEmails.trim() || null,
        });
      setNotice({ ok: true, text: "Zamanlanmış iş oluşturuldu." });
      await load();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function trigger(id: string) {
    try {
      await ososApi.triggerJob(id);
      setNotice({ ok: true, text: "İş tetiklendi." });
      await load();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }

  async function remove(id: string) {
    try {
      await ososApi.deleteJob(id);
      await load();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }

  return {
    screen,
    setScreen,
    isWeather,
    serno,
    setSerno,
    daysBack,
    setDaysBack,
    type,
    setType,
    cronPreset,
    setCronPreset,
    customCron,
    setCustomCron,
    effectiveCron,
    name,
    setName,
    /** Sonuç maili alıcıları (virgülle ayrılmış; hava durumu işlerinde yok). */
    notifyEmails,
    setNotifyEmails,
    lat,
    setLat,
    lon,
    setLon,
    tz,
    setTz,
    tilt,
    setTilt,
    azimuth,
    setAzimuth,
    subs,
    /** OSOS işleri için hesap bağlı değilse uyarı gösterilir (hava durumu bağımsız). */
    showOsosWarning: !isWeather && ososLinked === false,
    busy,
    notice,
    jobs,
    reload: load,
    runNow,
    schedule,
    trigger,
    remove,
  };
}

// ---------------------------------------------------------------------------

export function useWeather() {
  const [lat, setLat] = useState(40.195);
  const [lon, setLon] = useState(29.06);
  const [start, setStart] = useState(daysAgo(7));
  const [end, setEnd] = useState(today());
  const [tz, setTz] = useState("Europe/Istanbul");
  const [tilt, setTilt] = useState<number | null>(null);
  const [azimuth, setAzimuth] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OsosResult | null>(null);
  const [view, setView] = useState<ResultViewMode>("table");

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    setView("table");
    try {
      setResult(
        await ososApi.weather({
          latitude: lat,
          longitude: lon,
          startDate: start,
          endDate: end,
          timezone: tz,
          tilt,
          azimuth,
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function download(id: number) {
    try {
      await ososApi.exportCsv(id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return {
    lat,
    setLat,
    lon,
    setLon,
    start,
    setStart,
    end,
    setEnd,
    tz,
    setTz,
    tilt,
    setTilt,
    azimuth,
    setAzimuth,
    busy,
    error,
    result,
    view,
    setView,
    run,
    download,
  };
}

/** Sayı alanı: boş bırakılırsa `null`. */
export function parseOptionalNumber(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
