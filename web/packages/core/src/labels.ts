// Ekranlarda ortak kullanılan Türkçe etiketler, menü yapısı ve seçenek listeleri.

import type { CustomerOsosKind, GenerationType, InstallationType, UserRole } from "./customerTypes";
import type { AlignmentMode, OsosScreen } from "./types";

// ---- Menü ----

export type NavIcon =
  | "home"
  | "search"
  | "history"
  | "clock"
  | "weather"
  | "gauge"
  | "layers"
  | "function"
  | "link"
  | "user"
  | "building"
  | "sliders";

export interface NavItem {
  title: string;
  path: string;
  icon: NavIcon;
  /** Yalnızca tam eşleşmede aktif (alt yolları olan sayfalar için). */
  exact?: boolean;
  /** Yalnızca danışmanlara gösterilir. */
  consultantOnly?: boolean;
}

export interface NavGroup {
  id: "main" | "customers" | "osos" | "epias" | "settings";
  /** Yalnızca danışmanlara gösterilir (müşteri kullanıcısı kendi müşteri sayfasını görür). */
  consultantOnly?: boolean;
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { id: "main", title: "Menü", items: [{ title: "Genel Bakış", path: "/", icon: "home", exact: true }] },
  { id: "customers", title: "Müşteriler", items: [{ title: "Müşteriler", path: "/customers", icon: "building" }] },
  {
    id: "osos",
    title: "OSOS",
    consultantOnly: true,
    items: [
      { title: "Sorgu", path: "/osos/query", icon: "search" },
      { title: "Geçmiş", path: "/osos/history", icon: "history" },
      { title: "Zamanlanmış İşler", path: "/osos/jobs", icon: "clock" },
      { title: "Hava Durumu", path: "/osos/weather", icon: "weather" },
    ],
  },
  {
    id: "epias",
    title: "EPİAŞ",
    consultantOnly: true,
    items: [
      { title: "Özet", path: "/epias", icon: "gauge", exact: true },
      { title: "Servisler", path: "/epias/endpoints", icon: "layers" },
      { title: "Formüller", path: "/epias/formulas", icon: "function" },
    ],
  },
  {
    id: "settings",
    title: "Ayarlar",
    items: [
      { title: "Bağlı Hesaplar", path: "/settings/connections", icon: "link", consultantOnly: true },
      { title: "Parametreler", path: "/settings/parameters", icon: "sliders", consultantOnly: true },
      { title: "Profil", path: "/settings/profile", icon: "user" },
    ],
  },
];

/**
 * Role göre menü. Rol henüz bilinmiyorsa (null) danışman menüsü gösterilir; müşteri kullanıcısı
 * OSOS/EPİAŞ ekranlarını görmez, "Müşteriler" yerine doğrudan kendi müşteri sayfasına gider.
 */
export function navFor(role: UserRole | null, customerId?: number | null): NavGroup[] {
  if (role !== "Customer") return NAV;
  return NAV.filter((g) => !g.consultantOnly)
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => !i.consultantOnly)
        .map((i) =>
          i.path === "/customers" && customerId ? { ...i, title: "Firma Bilgilerim", path: `/customers/${customerId}` } : i,
        ),
    }))
    .filter((g) => g.items.length > 0);
}

export function isNavActive(item: NavItem, pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return item.exact ? p === item.path : p === item.path || p.startsWith(item.path + "/");
}

/** Konum yolu: ör. ["EPİAŞ", "Servisler", "Detay"]. */
export function breadcrumbs(pathname: string): { title: string; path?: string }[] {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return [{ title: "Genel Bakış" }];
  for (const g of NAV) {
    for (const item of g.items) {
      if (item.path === "/") continue;
      if (p === item.path) return [{ title: g.title }, { title: item.title }];
      if (p.startsWith(item.path + "/") && !item.exact)
        return [{ title: g.title }, { title: item.title, path: item.path }, { title: "Detay" }];
    }
  }
  return [{ title: "FyBlue" }];
}

export function pageTitle(pathname: string): string {
  const crumbs = breadcrumbs(pathname);
  return crumbs[crumbs.length - 1].title;
}

// ---- OSOS ----

export const OSOS_SCREENS: { key: OsosScreen; label: string }[] = [
  { key: "Consumption", label: "Tüketim" },
  { key: "Endex", label: "Endeks" },
  { key: "Profiles", label: "Akım/Gerilim/Cosφ" },
  { key: "Subscriptions", label: "Aboneler" },
  { key: "Dashboard", label: "Dashboard" },
];

export function screenName(screen: string): string {
  const map: Record<string, string> = {
    Consumption: "Tüketim",
    Endex: "Endeks",
    Profiles: "Akım/Gerilim/Cosφ",
    Subscriptions: "Aboneler",
    Dashboard: "Dashboard",
    Weather: "Hava durumu",
  };
  return map[screen] ?? screen;
}

export const JOB_SCREENS: { key: string; label: string }[] = [
  { key: "Consumption", label: "Tüketim" },
  { key: "Endex", label: "Endeks" },
  { key: "Profiles", label: "Akım/Gerilim/Cosφ" },
  { key: "Subscriptions", label: "Aboneler" },
  { key: "Dashboard", label: "Dashboard (Owner tüketim)" },
  { key: "Weather", label: "Hava Durumu (Open-Meteo)" },
];

export const CRON_PRESETS: { value: string; label: string }[] = [
  { value: "", label: "Anlık (zamanlama yok)" },
  { value: "0 * * * *", label: "Her saat başı" },
  { value: "*/15 * * * *", label: "Her 15 dakikada" },
  { value: "0 8 * * *", label: "Her gün 08:00" },
  { value: "0 8 * * 1", label: "Her Pazartesi 08:00" },
  { value: "0 0 1 * *", label: "Her ayın 1'i 00:00" },
  { value: "custom", label: "Özel cron…" },
];

export type StateTone = "success" | "error" | "info" | "neutral";

/** Hangfire iş durumunun rozet tonu. */
export function jobStateTone(state: string | null | undefined): StateTone {
  switch (state) {
    case "Succeeded":
      return "success";
    case "Failed":
      return "error";
    case "Processing":
    case "Enqueued":
    case "Scheduled":
      return "info";
    default:
      return "neutral";
  }
}

export function shortJobId(id: string): string {
  const parts = id.split(":");
  return parts[parts.length - 1] || id;
}

// ---- EPİAŞ ----

export function prettyTag(tag: string): string {
  return tag.replace("-data-controller", "").replace("-export-controller", " (export)").replace(/-/g, " ");
}

export const ALIGNMENT_MODES: { mode: AlignmentMode; label: string; hint: string }[] = [
  {
    mode: "DateHour",
    label: "Saatlik",
    hint: "Her gün ve saat için ayrı bir sonuç üretilir. Saatlik verilerde (PTF, tüketim, üretim) önerilir.",
  },
  {
    mode: "Date",
    label: "Günlük",
    hint: "Her gün için tek bir sonuç üretilir; saatlik değerler seçtiğiniz birleştirmeyle (ortalama, toplam…) güne indirgenir.",
  },
  { mode: "None", label: "Tek sonuç", hint: "Seçilen tarih aralığının tamamı için tek bir değer üretilir." },
];

export function alignmentLabel(mode: string): string {
  return ALIGNMENT_MODES.find((a) => a.mode === mode)?.label ?? mode;
}

// ---- Bağlı hesaplar ----

export const CONNECTION_INFO = {
  osos: {
    title: "OSOS",
    subtitle: "UEDAŞ sayaç verileri",
    description:
      "UEDAŞ OSOS portalı (osos.uedas.com.tr) kullanıcı kodu ve şifreniz. Tüketim, endeks, profil sorguları ve zamanlanmış işler bu hesapla yapılır.",
    userLabel: "OSOS kullanıcı kodu",
  },
  epias: {
    title: "EPİAŞ Şeffaflık",
    subtitle: "Şeffaflık Platformu",
    description:
      "EPİAŞ Şeffaflık Platformu kullanıcı adı ve şifreniz. Kimlik doğrulaması doğrudan EPİAŞ (giris.epias.com.tr) tarafından yapılır.",
    userLabel: "EPİAŞ kullanıcı adı",
  },
} as const;

export const PAGE_TEXT = {
  overview: { subtitle: "OSOS ve EPİAŞ modüllerinizin özeti." },
  query: {
    title: "Sorgu",
    subtitle: "Tüketim, endeks, profil ve abone verilerini sorgulayın. Her sorgu geçmişe kaydedilir.",
  },
  history: {
    title: "Sorgu Geçmişi",
    subtitle: "Kaydedilen sorgular; sonucu görüntüleyin, CSV indirin veya tek tıkla tekrar çalıştırın.",
  },
  jobs: {
    title: "Zamanlanmış İşler",
    subtitle: "Sorguları hemen kuyruğa alın veya cron ile düzenli çalıştırın. Sonuçlar Geçmiş'e kaydedilir.",
  },
  weather: {
    title: "Hava Durumu",
    subtitle:
      "Open-Meteo saatlik ~35 değişken. Kaynak (Archive/Historical/Forecast) tarihe göre otomatik seçilir; sonuç Geçmiş'e kaydedilir.",
  },
  epias: {
    title: "Özet",
    subtitle: "Şeffaflık Platformu kataloğu ve toplu senkronizasyon. Aynı kayıtlar tekrar yazılmaz.",
  },
  endpoints: {
    title: "Servisler",
    subtitle: "Swagger'dan üretilen katalog. Her veri servisi kendi tablosuna tekrarsız yazılır.",
  },
  formulas: {
    title: "Formüller",
    subtitle:
      "Soldaki listeden OSOS sayaç verilerinizi ve EPİAŞ verilerini sürükleyip işlemlerle birleştirin. Farklı kaynaklar gün ve saate göre otomatik eşleştirilir.",
  },
  connections: {
    title: "Bağlı Hesaplar",
    subtitle:
      "OSOS ve EPİAŞ, FyBlue girişinizden bağımsız kendi kullanıcı adı/şifreleriyle çalışır. Şifreler sunucuda şifrelenmiş olarak saklanır.",
  },
  profile: { title: "Profil", subtitle: "FyBlue hesabınız. OSOS ve EPİAŞ bağlantıları bu hesaba aittir." },
} as const;

// ---- Müşteri modülü ----

export const INSTALLATION_TYPES: { value: InstallationType; label: string }[] = [
  { value: "CONSUMPTION", label: "Tüketim" },
  { value: "PRODUCTION", label: "Üretim" },
  { value: "PRODUCTION_CONSUMPTION", label: "Üretim + Tüketim" },
];

export const GENERATION_TYPES: { value: GenerationType; label: string }[] = [
  { value: "SOLAR", label: "GES (Güneş)" },
  { value: "WIND", label: "RES (Rüzgâr)" },
  { value: "HYDRO", label: "HES (Hidroelektrik)" },
  { value: "GEOTHERMAL", label: "JES (Jeotermal)" },
  { value: "COGENERATION", label: "Kojenerasyon" },
  { value: "OTHER", label: "Diğer" },
];

export const PLANT_SUBTYPES: { value: string; label: string }[] = [
  { value: "ROOFTOP", label: "Çatı" },
  { value: "GROUND", label: "Arazi" },
  { value: "CARPORT", label: "Otopark (carport)" },
  { value: "FACADE", label: "Cephe" },
  { value: "OTHER", label: "Diğer" },
];

const labelOf = (list: { value: string; label: string }[], v?: string | null) =>
  (v && list.find((x) => x.value === v)?.label) || v || "—";
export const installationTypeLabel = (v?: string | null) => labelOf(INSTALLATION_TYPES, v);
export const generationTypeLabel = (v?: string | null) => labelOf(GENERATION_TYPES, v);
export const plantSubtypeLabel = (v?: string | null) => labelOf(PLANT_SUBTYPES, v);
export const hasProduction = (t?: string | null) => t === "PRODUCTION" || t === "PRODUCTION_CONSUMPTION";

export type CustomerTab =
  | "summary"
  | "installations"
  | "consumption"
  | "production"
  | "endex"
  | "documents"
  | "invoices"
  | "osos"
  | "users";

/** Müşteri detay sekmeleri; ilk açılış Özet. Kullanıcılar sekmesi yalnızca danışmanda. */
export const CUSTOMER_TABS: { key: CustomerTab; label: string; consultantOnly?: boolean }[] = [
  { key: "summary", label: "Özet" },
  { key: "installations", label: "Tesisatlar" },
  { key: "consumption", label: "Tüketim" },
  { key: "production", label: "Üretim" },
  { key: "endex", label: "Endeksler" },
  { key: "documents", label: "Belgeler" },
  { key: "invoices", label: "Faturalar" },
  { key: "osos", label: "OSOS / Entegrasyon" },
  { key: "users", label: "Kullanıcılar", consultantOnly: true },
];

export const CUSTOMER_OSOS_TABS: Record<"consumption" | "production" | "endex", { kind: CustomerOsosKind; title: string; hint: string }> = {
  consumption: { kind: "consumption", title: "Tüketim", hint: "Müşterinin tüm OSOS aboneliklerinden tüketim verisi (canlı sorgu)." },
  production: { kind: "production", title: "Üretim", hint: "Üretim tesisatlarına eşleşmiş aboneliklerin verisi. Tip: OSOS tüketim/üretim yönü." },
  endex: { kind: "endex", title: "Endeksler", hint: "Aboneliklerin güncel endeks okumaları." },
};

export const INVOICE_DOCUMENT_TYPE = "FATURA";

export const PARAMETER_GROUP_HINTS: Record<string, string> = {
  DOCUMENT_TYPE: "Belge yüklerken seçilen tipler. 'Fatura' sistem kaydıdır ve Faturalar sekmesini besler.",
  DISTRIBUTION_COMPANY: "Tesisat ve OSOS bağlantılarında seçilen dağıtım şirketleri.",
  PANEL_BRAND: "GES panel markaları (öneri listesi).",
  INVERTER_BRAND: "İnverter markaları (öneri listesi).",
  METER_BRAND: "Sayaç markaları.",
};

export const CUSTOMER_PAGE_TEXT = {
  list: { title: "Müşteriler", subtitle: "Müşteri kartları, tesisatlar, OSOS bağlantıları ve belgeler." },
  parameters: {
    title: "Parametreler",
    subtitle: "Belge tipleri, dağıtım şirketleri ve marka listeleri. Kullanılan kayıtlar silinmez, pasife alınır.",
  },
} as const;
