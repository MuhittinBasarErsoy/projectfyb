import { useEffect, useSyncExternalStore } from "react";
import { authApi } from "./api";
import { auth } from "./auth";
import type { UserRole } from "./customerTypes";

/**
 * Giriş yapan kullanıcının rolü ve müşteri kapsamı (api/auth/me). Menü ve düzenleme düğmeleri buna göre
 * gösterilir; asıl yetki kontrolü sunucudadır. Rol DB'den okunduğu için eski jetonlarda da doğrudur.
 */

export interface CurrentUserSnapshot {
  loaded: boolean;
  role: UserRole | null;
  customerId: number | null;
}

const empty: CurrentUserSnapshot = { loaded: false, role: null, customerId: null };
let state = empty;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: CurrentUserSnapshot) {
  state = next;
  listeners.forEach((l) => l());
}

export const currentUser = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  ensureLoaded(): Promise<void> {
    if (state.loaded || !auth.isAuthenticated()) return Promise.resolve();
    inflight ??= authApi
      .profile()
      .then((p) => set({ loaded: true, role: p.role ?? "Consultant", customerId: p.customerId ?? null }))
      .catch(() => {
        /* 401 ise oturum zaten kapanır; diğer hatalarda menü varsayılan kalır */
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  reset: () => set(empty),
};

auth.subscribe(() => {
  currentUser.reset();
  if (auth.isAuthenticated()) void currentUser.ensureLoaded();
});

/** Rol bilgisi; ilk kullanımda sunucudan yüklenir. Yüklenene kadar isConsultant=false (düzenleme gizli). */
export function useCurrentUser() {
  const snap = useSyncExternalStore(currentUser.subscribe, currentUser.get, () => empty);
  useEffect(() => {
    void currentUser.ensureLoaded();
  }, []);
  return {
    ...snap,
    isConsultant: snap.role === "Consultant",
    isCustomer: snap.role === "Customer",
  };
}
