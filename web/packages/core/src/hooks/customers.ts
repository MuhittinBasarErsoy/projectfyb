import { useCallback, useEffect, useMemo, useState } from "react";
import { customersApi, mailApi, parametersApi } from "../api";
import type {
  CustomerDto,
  CustomerListItem,
  CustomerOsosResult,
  CustomerSaveRequest,
  CustomerSummaryDto,
  CustomerUserDto,
  DocumentDto,
  InstallationDto,
  InstallationSaveRequest,
  OsosConnectionDto,
  OsosConnectionSaveRequest,
  OsosSubscriptionDto,
  ParameterGroupDto,
  ParameterValueDto,
  ParameterValueSaveRequest,
  ProductionSiteInfoDto,
} from "../customerTypes";
import { daysAgo, today } from "../format";
import { errorMessage } from "../http";
import { CUSTOMER_TABS, hasProduction, INVOICE_DOCUMENT_TYPE, type CustomerTab } from "../labels";
import { useCurrentUser } from "../session";
import type { Notice } from "./auth";
import { useResultView } from "./osos";

// ---------------------------------------------------------------------------
// Ortak: bir işlemi çalıştırıp busy/notice yönetimi

function useAction() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fn();
      if (success) setNotice({ ok: true, text: typeof success === "function" ? success(r) : success });
      return r;
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, notice, setNotice, run };
}

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Sayı alanı: "" → null, "12,5" → 12.5. */
export function parseNumberInput(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const numberInputValue = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function fmtKw(n: number | null | undefined, unit = "kW"): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${unit}`;
}

export function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

// ---------------------------------------------------------------------------
// Parametre seçenekleri (seçim listeleri için, oturum boyunca önbellek)

let parameterCache: Promise<ParameterGroupDto[]> | null = null;

export function useParameterOptions() {
  const [groups, setGroups] = useState<ParameterGroupDto[]>([]);
  useEffect(() => {
    parameterCache ??= parametersApi.list().catch((e) => {
      parameterCache = null;
      throw e;
    });
    parameterCache.then(setGroups).catch(() => setGroups([]));
  }, []);
  const values = useCallback(
    (code: string): ParameterValueDto[] => groups.find((g) => g.code === code)?.values.filter((v) => v.isActive) ?? [],
    [groups],
  );
  return { groups, values };
}

/** Parametre ekranında değişiklik olunca seçim listeleri yeniden yüklensin. */
export function invalidateParameterOptions() {
  parameterCache = null;
}

// ---------------------------------------------------------------------------
// Müşteri formu (liste ekranındaki "Yeni müşteri" ve detaydaki "Düzenle")

const emptyCustomer: CustomerSaveRequest = {
  customerCode: "",
  title: "",
  shortName: "",
  taxNumber: "",
  taxOffice: "",
  authorizedPerson: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  isActive: true,
};

export const CUSTOMER_FIELDS: { key: keyof CustomerSaveRequest; label: string; required?: boolean; wide?: boolean; multiline?: boolean }[] = [
  { key: "customerCode", label: "Müşteri kodu", required: true },
  { key: "title", label: "Ünvan", required: true, wide: true },
  { key: "shortName", label: "Kısa ad" },
  { key: "taxNumber", label: "Vergi no" },
  { key: "taxOffice", label: "Vergi dairesi" },
  { key: "authorizedPerson", label: "Yetkili kişi" },
  { key: "phone", label: "Telefon" },
  { key: "email", label: "E-posta" },
  { key: "address", label: "Adres", wide: true, multiline: true },
  { key: "notes", label: "Notlar", wide: true, multiline: true },
];

export function useCustomerForm(onSaved: (c: CustomerDto) => void) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [values, setValues] = useState<CustomerSaveRequest>(emptyCustomer);
  const { busy, notice, setNotice, run } = useAction();

  function startNew() {
    setEditId(null);
    setValues(emptyCustomer);
    setNotice(null);
    setOpen(true);
  }

  function startEdit(c: CustomerDto) {
    setEditId(c.id);
    setValues({ ...emptyCustomer, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ""])), isActive: c.isActive });
    setNotice(null);
    setOpen(true);
  }

  const set = <K extends keyof CustomerSaveRequest>(key: K, value: CustomerSaveRequest[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function save() {
    const req: CustomerSaveRequest = {
      ...values,
      shortName: blank(values.shortName),
      taxNumber: blank(values.taxNumber),
      taxOffice: blank(values.taxOffice),
      authorizedPerson: blank(values.authorizedPerson),
      phone: blank(values.phone),
      email: blank(values.email),
      address: blank(values.address),
      notes: blank(values.notes),
    };
    const saved = await run(() => (editId ? customersApi.update(editId, req) : customersApi.create(req)));
    if (saved) {
      setOpen(false);
      onSaved(saved);
    }
  }

  return { open, close: () => setOpen(false), isEdit: editId !== null, values, set, save, busy, notice, startNew, startEdit };
}

// ---------------------------------------------------------------------------
// Müşteri listesi

export function useCustomerList() {
  const [items, setItems] = useState<CustomerListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();

  const load = useCallback(async () => {
    try {
      setItems(await customersApi.list(search, includeInactive));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
      setItems((i) => i ?? []);
    }
  }, [search, includeInactive]);

  // Arama yazarken her tuşta istek atılmasın.
  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const form = useCustomerForm(() => void load());

  return {
    items,
    search,
    setSearch,
    includeInactive,
    setIncludeInactive,
    error,
    reload: load,
    form,
    canEdit: user.isConsultant,
    /** Müşteri kullanıcısı liste yerine doğrudan kendi sayfasına yönlendirilir. */
    redirectTo: user.isCustomer && user.customerId ? `/customers/${user.customerId}` : null,
  };
}

// ---------------------------------------------------------------------------
// Müşteri detayı (üst bilgi + sekme seçimi + Özet)

export function useCustomerDetail(id: number) {
  const [summary, setSummary] = useState<CustomerSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<CustomerTab>("summary");
  const user = useCurrentUser();

  const load = useCallback(async () => {
    try {
      setSummary(await customersApi.summary(id));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    setSummary(null);
    setTab("summary");
    void load();
  }, [load]);

  const form = useCustomerForm(() => void load());

  return {
    id,
    summary,
    customer: summary?.customer ?? null,
    error,
    reload: load,
    tab,
    setTab,
    tabs: CUSTOMER_TABS.filter((t) => !t.consultantOnly || user.isConsultant),
    canEdit: user.isConsultant,
    form,
  };
}

// ---------------------------------------------------------------------------
// Tesisatlar

const emptyPsi: ProductionSiteInfoDto = {};

const emptyInstallation: InstallationSaveRequest = {
  name: "",
  installationType: "CONSUMPTION",
  generationType: null,
  distributionCompanyId: null,
  manualAddress: "",
  manualInstalledPowerKw: null,
  manualContractPowerKw: null,
  voltageLevel: "",
  meterType: "",
  latitude: null,
  longitude: null,
  isActive: true,
  productionSiteInfo: null,
};

export function useInstallations(customerId: number) {
  const [items, setItems] = useState<InstallationDto[] | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<{ id: number | null; source: InstallationDto | null } | null>(null);
  const [form, setForm] = useState<InstallationSaveRequest>(emptyInstallation);
  const { busy, notice, setNotice, run } = useAction();
  const params = useParameterOptions();
  const user = useCurrentUser();

  const load = useCallback(async () => {
    try {
      setItems(await customersApi.installations(customerId, includeInactive));
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
      setItems((i) => i ?? []);
    }
  }, [customerId, includeInactive, setNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  function startNew() {
    setForm(emptyInstallation);
    setEditing({ id: null, source: null });
    setNotice(null);
  }

  function startEdit(i: InstallationDto) {
    setForm({
      name: i.name,
      installationType: i.installationType,
      generationType: i.generationType ?? null,
      distributionCompanyId: i.distributionCompanyId ?? null,
      manualAddress: i.manualAddress ?? "",
      manualInstalledPowerKw: i.manualInstalledPowerKw ?? null,
      manualContractPowerKw: i.manualContractPowerKw ?? null,
      voltageLevel: i.voltageLevel ?? "",
      meterType: i.meterType ?? "",
      latitude: i.latitude ?? null,
      longitude: i.longitude ?? null,
      isActive: i.isActive,
      productionSiteInfo: i.productionSiteInfo ?? null,
    });
    setEditing({ id: i.id, source: i });
    setNotice(null);
  }

  const set = <K extends keyof InstallationSaveRequest>(key: K, value: InstallationSaveRequest[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setPsi = <K extends keyof ProductionSiteInfoDto>(key: K, value: ProductionSiteInfoDto[K]) =>
    setForm((f) => ({ ...f, productionSiteInfo: { ...(f.productionSiteInfo ?? emptyPsi), [key]: value } }));

  const production = hasProduction(form.installationType);
  const solar = production && form.generationType === "SOLAR";

  async function save() {
    const req: InstallationSaveRequest = {
      ...form,
      generationType: production ? form.generationType : null,
      manualAddress: blank(form.manualAddress),
      voltageLevel: blank(form.voltageLevel),
      meterType: blank(form.meterType),
      productionSiteInfo: production ? (form.productionSiteInfo ?? emptyPsi) : null,
    };
    const id = editing?.id;
    const saved = await run(
      () => (id ? customersApi.updateInstallation(id, req) : customersApi.createInstallation(customerId, req)),
      "Tesisat kaydedildi.",
    );
    if (saved) {
      setEditing(null);
      await load();
    }
  }

  return {
    items,
    includeInactive,
    setIncludeInactive,
    reload: load,
    editing,
    /** Düzenlenen tesisatın OSOS kaynak değerleri (manuel alanların yanında gösterilir). */
    source: editing?.source ?? null,
    form,
    set,
    setPsi,
    production,
    solar,
    startNew,
    startEdit,
    cancel: () => setEditing(null),
    save,
    busy,
    notice,
    canEdit: user.isConsultant,
    distributionCompanies: params.values("DISTRIBUTION_COMPANY"),
    panelBrands: params.values("PANEL_BRAND"),
    inverterBrands: params.values("INVERTER_BRAND"),
  };
}

// ---------------------------------------------------------------------------
// Tüketim / Üretim / Endeks sekmeleri (canlı OSOS)

export function useCustomerOsosTab(customerId: number, kind: "consumption" | "production" | "endex") {
  const [start, setStart] = useState(daysAgo(7));
  const [end, setEnd] = useState(today());
  const [installationId, setInstallationId] = useState<number | null>(null);
  const [type, setType] = useState(2);
  const [installations, setInstallations] = useState<InstallationDto[]>([]);
  const [result, setResult] = useState<CustomerOsosResult | null>(null);
  const { busy, notice, run } = useAction();
  const view = useResultView(result?.rawJson);

  useEffect(() => {
    customersApi
      .installations(customerId)
      .then((list) => setInstallations(kind === "production" ? list.filter((i) => hasProduction(i.installationType)) : list))
      .catch(() => setInstallations([]));
    setResult(null);
  }, [customerId, kind]);

  async function query() {
    const r = await run(() =>
      customersApi.osos(customerId, kind, { startDate: start, endDate: end, installationId, type }),
    );
    if (r) setResult(r);
  }

  return {
    start,
    setStart,
    end,
    setEnd,
    installationId,
    setInstallationId,
    type,
    setType,
    usesType: kind !== "endex",
    installations,
    query,
    busy,
    notice,
    result,
    view,
  };
}

// ---------------------------------------------------------------------------
// Belgeler / Faturalar

export interface DocumentForm {
  file: File | null;
  documentTypeId: number | null;
  installationId: number | null;
  title: string;
  documentDate: string;
  periodYear: string;
  periodMonth: string;
  expiryDate: string;
  description: string;
}

const emptyDocForm: DocumentForm = {
  file: null,
  documentTypeId: null,
  installationId: null,
  title: "",
  documentDate: "",
  periodYear: "",
  periodMonth: "",
  expiryDate: "",
  description: "",
};

/** invoices=true → yalnızca Fatura tipindeki belgeler (Faturalar sekmesi). */
export function useDocuments(customerId: number, invoices = false) {
  const [items, setItems] = useState<DocumentDto[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<number | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [installations, setInstallations] = useState<InstallationDto[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState<DocumentForm>(emptyDocForm);
  const [formKey, setFormKey] = useState(0);
  const { busy, notice, setNotice, run } = useAction();
  const params = useParameterOptions();
  const user = useCurrentUser();

  const allTypes = params.values("DOCUMENT_TYPE");
  const invoiceType = allTypes.find((t) => t.code === INVOICE_DOCUMENT_TYPE) ?? null;
  const types = invoices ? (invoiceType ? [invoiceType] : []) : allTypes;
  const effectiveType = invoices ? (invoiceType?.id ?? null) : typeFilter;

  const load = useCallback(async () => {
    if (invoices && !invoiceType) return;
    try {
      setItems(await customersApi.documents(customerId, { documentTypeId: effectiveType, includeInactive }));
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
      setItems((i) => i ?? []);
    }
  }, [customerId, effectiveType, includeInactive, invoices, invoiceType, setNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    customersApi.installations(customerId).then(setInstallations).catch(() => setInstallations([]));
  }, [customerId]);

  const set = <K extends keyof DocumentForm>(key: K, value: DocumentForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  function openUpload() {
    const now = new Date();
    setForm({
      ...emptyDocForm,
      documentTypeId: invoices ? (invoiceType?.id ?? null) : null,
      periodYear: invoices ? String(now.getFullYear()) : "",
      periodMonth: invoices ? String(now.getMonth() + 1) : "",
    });
    setFormKey((k) => k + 1); // dosya girişini sıfırlar
    setNotice(null);
    setUploadOpen(true);
  }

  async function upload() {
    if (!form.file) return setNotice({ ok: false, text: "Dosya seçin." });
    if (!form.documentTypeId) return setNotice({ ok: false, text: "Belge tipi seçin." });
    const file = form.file;
    const documentTypeId = form.documentTypeId;
    const ok = await run(
      () =>
        customersApi.uploadDocument(customerId, {
          file,
          documentTypeId,
          installationId: form.installationId,
          title: form.title.trim() || undefined,
          documentDate: form.documentDate || undefined,
          periodYear: parseNumberInput(form.periodYear),
          periodMonth: parseNumberInput(form.periodMonth),
          expiryDate: form.expiryDate || undefined,
          description: form.description.trim() || undefined,
        }),
      "Belge yüklendi.",
    );
    if (ok) {
      setUploadOpen(false);
      await load();
    }
  }

  async function remove(d: DocumentDto) {
    if (typeof window !== "undefined" && !window.confirm(`"${d.title}" pasife alınsın mı? (Danışmanlar geri alabilir.)`)) return;
    await run(() => customersApi.deleteDocument(d.id), "Belge pasife alındı.");
    await load();
  }

  async function restore(d: DocumentDto) {
    await run(() => customersApi.restoreDocument(d.id), "Belge geri alındı.");
    await load();
  }

  async function download(d: DocumentDto) {
    await run(() => customersApi.downloadDocument(d));
  }

  return {
    invoices,
    items,
    types,
    typeFilter,
    setTypeFilter,
    includeInactive,
    setIncludeInactive,
    installations,
    uploadOpen,
    openUpload,
    closeUpload: () => setUploadOpen(false),
    form,
    formKey,
    set,
    upload,
    remove,
    restore,
    download,
    busy,
    notice,
    /** Silme/pasife alma yalnızca danışmanda (müşteri kendi yüklediğini de silemez). */
    canDelete: user.isConsultant,
    canSeeInactive: user.isConsultant,
  };
}

// ---------------------------------------------------------------------------
// OSOS / Entegrasyon

const emptyConnection: OsosConnectionSaveRequest = {
  distributionCompanyId: null,
  connectionName: "",
  username: "",
  password: "",
  isActive: true,
};

export function useOsosIntegration(customerId: number) {
  const [connections, setConnections] = useState<OsosConnectionDto[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<OsosSubscriptionDto[] | null>(null);
  const [installations, setInstallations] = useState<InstallationDto[]>([]);
  const [editing, setEditing] = useState<{ id: number | null } | null>(null);
  const [form, setForm] = useState<OsosConnectionSaveRequest>(emptyConnection);
  const [subsQuery, setSubsQuery] = useState("");
  const { busy, notice, setNotice, run } = useAction();
  const params = useParameterOptions();
  const user = useCurrentUser();

  const load = useCallback(async () => {
    try {
      const [c, s, i] = await Promise.all([
        customersApi.connections(customerId),
        customersApi.subscriptions(customerId),
        customersApi.installations(customerId),
      ]);
      setConnections(c);
      setSubscriptions(s);
      setInstallations(i);
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
      setConnections((x) => x ?? []);
      setSubscriptions((x) => x ?? []);
    }
  }, [customerId, setNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof OsosConnectionSaveRequest>(key: K, value: OsosConnectionSaveRequest[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function startNew() {
    setForm(emptyConnection);
    setEditing({ id: null });
    setNotice(null);
  }

  function startEdit(c: OsosConnectionDto) {
    setForm({
      distributionCompanyId: c.distributionCompanyId ?? null,
      connectionName: c.connectionName ?? "",
      username: c.username,
      password: "",
      isActive: c.isActive,
    });
    setEditing({ id: c.id });
    setNotice(null);
  }

  async function save() {
    const id = editing?.id;
    const req = { ...form, connectionName: blank(form.connectionName), password: blank(form.password) };
    const ok = await run(
      () => (id ? customersApi.updateConnection(id, req) : customersApi.createConnection(customerId, req)),
      "Bağlantı kaydedildi. Abonelikleri çekmek için “Senkronize et”ye basın.",
    );
    if (ok) {
      setEditing(null);
      await load();
    }
  }

  async function test(c: OsosConnectionDto) {
    const r = await run(() => customersApi.testConnection(c.id));
    if (r) setNotice({ ok: r.success, text: r.message ?? "" });
    await load();
  }

  async function sync(c: OsosConnectionDto) {
    const r = await run(() => customersApi.syncConnection(c.id));
    if (r)
      setNotice({
        ok: r.success,
        text: r.success ? `${r.message} (yeni ${r.added}, güncellenen ${r.updated}, pasife alınan ${r.deactivated})` : r.message,
      });
    await load();
  }

  async function link(s: OsosSubscriptionDto, installationId: number | null) {
    await run(() => customersApi.linkSubscription(s.id, installationId), installationId ? "Abonelik tesisata eşleştirildi." : "Eşleşme kaldırıldı.");
    await load();
  }

  async function createInstallation(s: OsosSubscriptionDto) {
    await run(() => customersApi.createInstallationFromSubscription(s.id), "Tesisat oluşturuldu ve eşleştirildi.");
    await load();
  }

  const visibleSubscriptions = useMemo(() => {
    const q = subsQuery.trim().toLocaleLowerCase("tr-TR");
    if (!subscriptions || !q) return subscriptions;
    return subscriptions.filter((s) =>
      [s.sourceTitle, s.identifierValue, String(s.subscriptionSerno), s.meterSerial, s.installationName]
        .some((v) => v?.toLocaleLowerCase("tr-TR").includes(q)),
    );
  }, [subscriptions, subsQuery]);

  return {
    connections,
    subscriptions: visibleSubscriptions,
    subscriptionCount: subscriptions?.length ?? 0,
    unmatchedCount: subscriptions?.filter((s) => !s.installationId).length ?? 0,
    subsQuery,
    setSubsQuery,
    installations,
    editing,
    form,
    set,
    startNew,
    startEdit,
    cancel: () => setEditing(null),
    save,
    test,
    sync,
    link,
    createInstallation,
    busy,
    notice,
    reload: load,
    canEdit: user.isConsultant,
    distributionCompanies: params.values("DISTRIBUTION_COMPANY"),
  };
}

// ---------------------------------------------------------------------------
// Müşteri kullanıcıları (danışman)

export function useCustomerUsers(customerId: number) {
  const [users, setUsers] = useState<CustomerUserDto[] | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, notice, setNotice, run } = useAction();

  const load = useCallback(async () => {
    try {
      setUsers(await customersApi.users(customerId));
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
      setUsers((u) => u ?? []);
    }
  }, [customerId, setNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const ok = await run(
      () => customersApi.createUser(customerId, { username: username.trim(), email: blank(email), password }),
      (u) => `"${u.username}" oluşturuldu. Kullanıcı bu bilgilerle giriş yapıp yalnızca bu müşterinin verilerini görür.`,
    );
    if (ok) {
      setUsername("");
      setEmail("");
      setPassword("");
      await load();
    }
  }

  async function remove(u: CustomerUserDto) {
    if (typeof window !== "undefined" && !window.confirm(`"${u.username}" kullanıcısı silinsin mi?`)) return;
    await run(() => customersApi.deleteUser(customerId, u.id), "Kullanıcı silindi.");
    await load();
  }

  return { users, username, setUsername, email, setEmail, password, setPassword, create, remove, busy, notice };
}

// ---------------------------------------------------------------------------
// Parametre yönetimi (danışman)

const emptyValue: ParameterValueSaveRequest = { code: "", name: "", description: "", sortOrder: 0, isActive: true };

export function useParametersAdmin() {
  const [groups, setGroups] = useState<ParameterGroupDto[] | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: number | null; isSystem: boolean } | null>(null);
  const [form, setForm] = useState<ParameterValueSaveRequest>(emptyValue);
  const { busy, notice, setNotice, run } = useAction();
  const user = useCurrentUser();

  const load = useCallback(async () => {
    try {
      const g = await parametersApi.list(true);
      setGroups(g);
      setGroupId((id) => id ?? g[0]?.id ?? null);
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
      setGroups((x) => x ?? []);
    }
  }, [setNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  const group = groups?.find((g) => g.id === groupId) ?? null;
  const set = <K extends keyof ParameterValueSaveRequest>(key: K, value: ParameterValueSaveRequest[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function startNew() {
    const max = group?.values.reduce((m, v) => Math.max(m, v.sortOrder), 0) ?? 0;
    setForm({ ...emptyValue, sortOrder: max + 1 });
    setEditing({ id: null, isSystem: false });
    setNotice(null);
  }

  function startEdit(v: ParameterValueDto) {
    setForm({ code: v.code, name: v.name, description: v.description ?? "", sortOrder: v.sortOrder, isActive: v.isActive });
    setEditing({ id: v.id, isSystem: v.isSystem });
    setNotice(null);
  }

  async function save() {
    if (!group) return;
    const id = editing?.id;
    const req = { ...form, description: blank(form.description) };
    const ok = await run(
      () => (id ? parametersApi.updateValue(id, req) : parametersApi.createValue(group.id, req)),
      "Kaydedildi.",
    );
    if (ok) {
      invalidateParameterOptions();
      setEditing(null);
      await load();
    }
  }

  async function toggleActive(v: ParameterValueDto) {
    const ok = await run(
      () => parametersApi.updateValue(v.id, { code: v.code, name: v.name, description: v.description, sortOrder: v.sortOrder, isActive: !v.isActive }),
      v.isActive ? "Pasife alındı." : "Aktifleştirildi.",
    );
    if (ok) {
      invalidateParameterOptions();
      await load();
    }
  }

  return {
    groups,
    group,
    groupId,
    setGroupId: (id: number) => {
      setGroupId(id);
      setEditing(null);
    },
    editing,
    form,
    set,
    startNew,
    startEdit,
    cancel: () => setEditing(null),
    save,
    toggleActive,
    busy,
    notice,
    canEdit: user.isConsultant,
  };
}

// ---------------------------------------------------------------------------
// SMTP test (Bağlı Hesaplar)

export function useMailSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [to, setTo] = useState("");
  const { busy, notice, setNotice, run } = useAction();
  const user = useCurrentUser();

  useEffect(() => {
    mailApi.status().then((s) => setEnabled(s.enabled)).catch(() => setEnabled(false));
  }, []);

  async function test() {
    const r = await run(() => mailApi.test(to));
    if (r) setNotice({ ok: r.success, text: r.message ?? "" });
  }

  return { enabled, to, setTo, test, busy, notice, canTest: user.isConsultant };
}
