import { useSyncExternalStore } from "react";

/**
 * Tek uygulama oturumu (JWT). Üç şablon da aynı origin'de çalıştığı için jeton
 * localStorage'da ortak tutulur: şablon değiştirmek oturumu kapatmaz.
 */

const TOKEN_KEY = "fyblue.token";

export interface AuthSnapshot {
  token: string | null;
  username: string | null;
}

let state: AuthSnapshot = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function readPayload(jwt: string): Record<string, unknown> | null {
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="))
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// 60 sn pay: sınırdaki jetonla istek atıp 401 almak yerine baştan giriş istenir.
function isExpired(payload: Record<string, unknown>) {
  const exp = payload.exp;
  return typeof exp === "number" && exp * 1000 <= Date.now() + 60_000;
}

function readName(payload: Record<string, unknown>): string | null {
  for (const key of ["unique_name", "name"]) {
    const v = payload[key];
    if (typeof v === "string") return v;
  }
  return null;
}

function load(): AuthSnapshot {
  if (typeof window === "undefined") return { token: null, username: null };
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    /* depolama kapalı */
  }
  if (!token) return { token: null, username: null };
  const payload = readPayload(token);
  if (!payload || isExpired(payload)) {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* yok say */
    }
    return { token: null, username: null };
  }
  return { token, username: readName(payload) };
}

export const auth = {
  get: () => state,
  isAuthenticated: () => state.token !== null,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  signIn(token: string, username: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* oturum yalnızca bellekte kalır */
    }
    state = { token, username };
    emit();
  },

  signOut() {
    if (state.token === null) return;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* yok say */
    }
    state = { token: null, username: null };
    emit();
  },
};

// Başka sekmede giriş/çıkış yapılırsa bu sekme de güncellensin.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY) {
      state = load();
      emit();
    }
  });
}

const serverSnapshot: AuthSnapshot = { token: null, username: null };

export function useAuth() {
  const snap = useSyncExternalStore(auth.subscribe, auth.get, () => serverSnapshot);
  return {
    ...snap,
    isAuthenticated: snap.token !== null,
    initial: snap.username ? snap.username.slice(0, 1).toLocaleUpperCase("tr-TR") : "?",
    signOut: auth.signOut,
  };
}

/** Yalnızca uygulama içi göreli adreslere dönülür (açık yönlendirme engeli). */
export function safeReturnUrl(returnUrl: string | null | undefined): string {
  if (
    !returnUrl ||
    returnUrl.includes("//") ||
    returnUrl.includes(":") ||
    /^\/?(signin|signup|login|register)/i.test(returnUrl)
  )
    return "/";
  return returnUrl.startsWith("/") ? returnUrl : "/" + returnUrl;
}
