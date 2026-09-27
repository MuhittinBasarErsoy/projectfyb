import { useEffect, useSyncExternalStore } from "react";
import { accountsApi } from "./api";
import { auth } from "./auth";
import { errorMessage } from "./http";
import type { ExternalAccountStatus, ExternalSystem, LinkResponse } from "./types";

/**
 * OSOS ve EPİAŞ hesap bağlantılarının durumu. Uygulama girişinden bağımsızdır:
 * her dış sistem kendi kullanıcı adı/şifresiyle ayrı ayrı bağlanır.
 */

interface ConnectionsSnapshot {
  osos: ExternalAccountStatus | null;
  epias: ExternalAccountStatus | null;
  loaded: boolean;
  error: string | null;
}

let state: ConnectionsSnapshot = { osos: null, epias: null, loaded: false, error: null };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<ConnectionsSnapshot>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const connections = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  refresh(): Promise<void> {
    if (!auth.isAuthenticated()) return Promise.resolve();
    inflight = (async () => {
      try {
        const [osos, epias] = await Promise.all([accountsApi.ososStatus(), accountsApi.epiasStatus()]);
        set({ osos, epias, loaded: true, error: null });
      } catch (e) {
        set({ error: errorMessage(e) });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  ensureLoaded(): Promise<void> {
    if (state.loaded) return Promise.resolve();
    return inflight ?? connections.refresh();
  },

  async link(system: ExternalSystem, username: string, password: string): Promise<LinkResponse> {
    const res =
      system === "osos"
        ? await accountsApi.linkOsos(username, password)
        : await accountsApi.linkEpias(username, password);
    await connections.refresh();
    return res;
  },

  async unlink(system: ExternalSystem) {
    if (system === "osos") await accountsApi.unlinkOsos();
    else await accountsApi.unlinkEpias();
    await connections.refresh();
  },

  /** Oturum kapanınca önbellek temizlenir (sonraki kullanıcıya sızmasın). */
  reset() {
    set({ osos: null, epias: null, loaded: false, error: null });
  },
};

auth.subscribe(() => {
  if (!auth.isAuthenticated()) connections.reset();
});

const serverSnapshot: ConnectionsSnapshot = { osos: null, epias: null, loaded: false, error: null };

/** Bağlantı durumunu okur; ilk kullanımda sunucudan yükler. */
export function useConnections() {
  const snap = useSyncExternalStore(connections.subscribe, connections.get, () => serverSnapshot);
  useEffect(() => {
    void connections.ensureLoaded();
  }, []);
  return {
    ...snap,
    get: (system: ExternalSystem) => (system === "osos" ? snap.osos : snap.epias),
    refresh: connections.refresh,
  };
}

export const systemLabel = (s: ExternalSystem) => (s === "osos" ? "OSOS" : "EPİAŞ");
