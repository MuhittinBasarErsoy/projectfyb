import { auth } from "./auth";

export const ErrorCodes = {
  OsosNotLinked: "osos_not_linked",
  EpiasNotLinked: "epias_not_linked",
  EpiasAuthFailed: "epias_auth_failed",
} as const;

/**
 * API hatası. `code` sunucunun verdiği ayırt edici koddur; ör. dış hesap bağlı
 * değilse `osos_not_linked`. Yalnızca 401 uygulama oturumunu kapatır.
 */
export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string | null;

  constructor(message: string, status?: number, code?: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  get isNotLinked() {
    return this.code === ErrorCodes.OsosNotLinked || this.code === ErrorCodes.EpiasNotLinked;
  }
}

/** Herhangi bir hatayı kullanıcıya gösterilebilir metne çevirir. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.name === "AbortError") return "";
  return "Beklenmeyen bir hata oluştu.";
}

// API aynı origin'dedir (sunucu şablonları kendisi barındırır). Geliştirmede Vite/Next vekili yönlendirir.
const BASE = "/";

async function send(method: string, url: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = auth.get().token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  try {
    return await fetch(BASE + url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new ApiError("Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.");
  }
}

function flattenErrors(errors: unknown): string | null {
  const parts: string[] = [];
  if (Array.isArray(errors)) parts.push(...errors.map(String));
  else if (errors && typeof errors === "object")
    for (const v of Object.values(errors)) if (Array.isArray(v)) parts.push(...v.map(String));
  return parts.length ? parts.join(" ") : null;
}

async function readError(res: Response): Promise<{ message: string; code: string | null }> {
  try {
    const text = await res.text();
    if (text.trim()) {
      const root = JSON.parse(text);
      const str = (k: string) => (typeof root?.[k] === "string" ? (root[k] as string) : null);
      const message = str("message") ?? str("detail") ?? str("title") ?? flattenErrors(root?.errors);
      if (message) return { message, code: str("code") };
    }
  } catch {
    /* gövde JSON değil */
  }
  const fallback: Record<number, string> = {
    401: "Oturum süresi doldu. Lütfen yeniden giriş yapın.",
    403: "Bu işlem için yetkiniz yok.",
    404: "Kayıt bulunamadı.",
  };
  return { message: fallback[res.status] ?? `İstek başarısız (HTTP ${res.status}).`, code: null };
}

async function ensureOk(res: Response) {
  if (res.ok) return;
  const { message, code } = await readError(res);
  // Oturum düştü → giriş ekranına dönülür (kabuk auth değişimini dinler).
  if (res.status === 401 && auth.isAuthenticated()) auth.signOut();
  throw new ApiError(message, res.status, code);
}

async function readJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("Sunucudan beklenmeyen yanıt geldi.", res.status);
  }
}

export const http = {
  async get<T>(url: string, signal?: AbortSignal): Promise<T> {
    const res = await send("GET", url, undefined, signal);
    await ensureOk(res);
    return readJson<T>(res);
  },

  async post<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const res = await send("POST", url, body ?? null, signal);
    await ensureOk(res);
    return readJson<T>(res);
  },

  /** 422/502 gövdesinde de anlamlı sonuç dönen uçlar için (EPİAŞ senkron/formül). */
  async postAllowingResultErrors<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const res = await send("POST", url, body, signal);
    if (res.status === 422 || res.status === 502) return readJson<T>(res);
    await ensureOk(res);
    return readJson<T>(res);
  },

  async del(url: string): Promise<void> {
    const res = await send("DELETE", url);
    await ensureOk(res);
  },

  /** Dosyayı indirir (CSV). Ad Content-Disposition'dan okunur. */
  async download(url: string, fallbackName: string): Promise<void> {
    const res = await send("GET", url);
    await ensureOk(res);
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
    const plain = /filename="?([^";]+)"?/i.exec(cd);
    const name = star ? decodeURIComponent(star[1]) : plain ? plain[1] : fallbackName;

    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  },
};
