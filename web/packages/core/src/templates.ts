/**
 * Arayüz şablonları. Her şablon ayrı bir uygulamadır ve sunucuda kendi yolunda
 * yayınlanır (/tailadmin/, /shadcn/, /starter/). Seçim bir çerezde tutulur;
 * sunucu kök adresi (/) bu çereze göre yönlendirir.
 */

export type TemplateId = "tailadmin" | "shadcn" | "starter";

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  origin: string;
  description: string;
  /** Seçicide küçük önizleme için şablonun kendi renkleri. */
  preview: { accent: string; bg: string; sidebar: string; line: string; radius: number };
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "tailadmin",
    name: "TailAdmin",
    origin: "React + Tailwind",
    description: "TailAdmin'in kendisi: Outfit yazı tipi, mavi marka rengi, geniş menü.",
    preview: { accent: "#465fff", bg: "#f9fafb", sidebar: "#ffffff", line: "#e4e7ec", radius: 4 },
  },
  {
    id: "shadcn",
    name: "Shadcn Dashboard",
    origin: "shadcndashboard",
    description: "Shadcn Dashboard'un kendisi: shadcn/ui bileşenleri, nötr gri tonlar.",
    preview: { accent: "#171717", bg: "#ffffff", sidebar: "#ffffff", line: "#e5e5e5", radius: 0 },
  },
  {
    id: "starter",
    name: "Next Shadcn Starter",
    origin: "Next.js · kiranism",
    description: "Next.js Shadcn Dashboard Starter'ın kendisi: Vercel teması, breadcrumb.",
    preview: { accent: "#000000", bg: "#fcfcfc", sidebar: "#fcfcfc", line: "#ebebeb", radius: 3 },
  },
];

export const DEFAULT_TEMPLATE: TemplateId = "tailadmin";
const COOKIE = "fyblue_template";

export function currentTemplate(): TemplateId {
  if (typeof document === "undefined") return DEFAULT_TEMPLATE;
  const m = /(?:^|;\s*)fyblue_template=([a-z]+)/.exec(document.cookie);
  const id = m?.[1];
  return TEMPLATES.some((t) => t.id === id) ? (id as TemplateId) : DEFAULT_TEMPLATE;
}

export function rememberTemplate(id: TemplateId) {
  document.cookie = `${COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Şablonlar arası ortak yol biçimi. Next.js şablonu (statik yayın) servis detayını
 * `/epias/endpoints/detail/?key=X` olarak açar; diğerleri `/epias/endpoints/X`.
 */
export function canonicalPath(pathname: string, search = ""): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/epias/endpoints/detail") {
    const key = new URLSearchParams(search).get("key");
    return key ? `/epias/endpoints/${encodeURIComponent(key)}` : "/epias/endpoints";
  }
  return p + (search && search !== "?" ? search : "");
}

/** Ortak yolu hedef şablonun biçimine çevirir. */
export function templatePath(id: TemplateId, path: string): string {
  const m = /^\/epias\/endpoints\/([^/?#]+)$/.exec(path);
  if (id === "starter") {
    if (m && m[1] !== "detail") return `/epias/endpoints/detail/?key=${m[1]}`;
    const [p, q] = path.split("?");
    return (p === "/" ? "/" : p.replace(/\/?$/, "/")) + (q ? `?${q}` : "");
  }
  return path;
}

/**
 * Başka bir şablona geçer. Oturum ortak olduğu için kullanıcı aynı sayfada kalır;
 * `path` verilmezse şablonun ana sayfası açılır.
 */
export function switchTemplate(id: TemplateId, path = "/") {
  rememberTemplate(id);
  const [p, q] = (path.startsWith("/") ? path : "/" + path).split("?");
  window.location.href = `/${id}${templatePath(id, canonicalPath(p, q ? `?${q}` : ""))}`;
}
