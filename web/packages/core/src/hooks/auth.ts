import { useEffect, useState } from "react";
import { authApi } from "../api";
import { connections } from "../connections";
import { errorMessage } from "../http";
import type { ExternalSystem, ProfileResponse } from "../types";

export interface Notice {
  ok: boolean;
  text: string;
}

export function useLoginForm(onSuccess: () => void) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError("Kullanıcı adı ve şifre zorunludur.");
      return;
    }
    setBusy(true);
    try {
      await authApi.login(username.trim(), password);
      // Başarıda busy açık kalır: sayfa kapanırken "zaten giriş yapılmış" yönlendirmesi araya girmesin.
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return { username, setUsername, password, setPassword, busy, error, submit };
}

export const PASSWORD_HINT = "En az 6 karakter; büyük harf, küçük harf ve rakam içermeli.";

export function useRegisterForm(onSuccess: () => void) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError("Kullanıcı adı ve şifre zorunludur.");
      return;
    }
    if (password !== password2) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setBusy(true);
    try {
      await authApi.register(username.trim(), email.trim(), password);
      // Başarıda busy açık kalır: sayfa kapanırken "zaten giriş yapılmış" yönlendirmesi araya girmesin.
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return {
    username,
    setUsername,
    email,
    setEmail,
    password,
    setPassword,
    password2,
    setPassword2,
    busy,
    error,
    submit,
  };
}

export function useProfile() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    authApi
      .profile()
      .then(setProfile)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  return { profile, error, loading: profile === null && error === null };
}

/** Bağlı Hesaplar kartı: bağla / güncelle / kaldır. */
export function useConnectionCard(system: ExternalSystem, currentUsername?: string | null) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function startEdit() {
    setUsername(currentUsername ?? "");
    setPassword("");
    setNotice(null);
    setEditing(true);
  }

  async function link(e?: { preventDefault(): void }) {
    e?.preventDefault();
    if (busy) return;
    setNotice(null);
    if (!username.trim() || !password.trim()) {
      setNotice({ ok: false, text: "Kullanıcı adı ve şifre zorunludur." });
      return;
    }
    setBusy(true);
    try {
      const res = await connections.link(system, username.trim(), password);
      setNotice(res.message ? { ok: res.success, text: res.message } : null);
      if (res.success) {
        setPassword("");
        setEditing(false);
      }
    } catch (err) {
      setNotice({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setNotice(null);
    try {
      await connections.unlink(system);
      setUsername("");
      setNotice({ ok: true, text: "Bağlantı kaldırıldı; saklanan şifre silindi." });
    } catch (err) {
      setNotice({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return {
    username,
    setUsername,
    password,
    setPassword,
    editing,
    cancelEdit: () => setEditing(false),
    startEdit,
    busy,
    notice,
    link,
    unlink,
  };
}
