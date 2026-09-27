import PageMeta from "@/components/common/PageMeta";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { Notice, PageHeader, Spinner } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { BoltIcon, CheckLineIcon, LockIcon, PencilIcon, PieChartIcon, PlugInIcon } from "@/icons";
import {
  CONNECTION_INFO,
  fmtDateTime,
  PAGE_TEXT,
  useConnectionCard,
  useConnections,
  type ExternalAccountStatus,
  type ExternalSystem,
} from "@fyblue/core";
import { useSearchParams } from "react-router";

function ConnectionCard({
  system,
  status,
  loaded,
}: {
  system: ExternalSystem;
  status: ExternalAccountStatus | null;
  loaded: boolean;
}) {
  const info = CONNECTION_INFO[system];
  const c = useConnectionCard(system, status?.username);
  const linked = status?.linked === true;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-white/90">
          {system === "osos" ? <PieChartIcon className="size-6" /> : <BoltIcon className="size-6" />}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{info.title}</h3>
          <div className="mt-1">
            {!loaded ? (
              <Badge size="sm" color="light">
                Kontrol ediliyor…
              </Badge>
            ) : linked ? (
              <Badge size="sm" color="success" startIcon={<CheckLineIcon className="size-3" />}>
                Bağlı · {status?.username}
              </Badge>
            ) : (
              <Badge size="sm" color="light">
                Bağlı değil
              </Badge>
            )}
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">{info.description}</p>

      <div className="mt-6">
        {linked && !c.editing ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 dark:bg-white/[0.03]">
              <div>
                <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Kullanıcı</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{status?.username}</p>
              </div>
              <div>
                <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Son güncelleme</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{fmtDateTime(status?.updatedAt)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" variant="outline" onClick={c.startEdit} startIcon={<PencilIcon className="size-5" />}>
                Bilgileri güncelle
              </Button>
              <Button size="sm" variant="danger" onClick={c.unlink} disabled={c.busy}>
                Bağlantıyı kaldır
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={c.link} className="space-y-5">
            <div>
              <Label>{info.userLabel}</Label>
              <Input autoComplete="off" value={c.username} onChange={(e) => c.setUsername(e.target.value)} />
            </div>
            <div>
              <Label>Şifre</Label>
              <Input type="password" autoComplete="new-password" value={c.password} onChange={(e) => c.setPassword(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" type="submit" disabled={c.busy}>
                {c.busy ? <Spinner /> : <PlugInIcon className="size-5" />}
                Doğrula ve bağla
              </Button>
              {c.editing && (
                <Button size="sm" variant="ghost" onClick={c.cancelEdit}>
                  Vazgeç
                </Button>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <LockIcon className="size-4 fill-current" /> Bilgiler önce {info.title} sunucusunda doğrulanır; yalnızca başarılıysa kaydedilir.
            </p>
          </form>
        )}
      </div>

      {c.notice && (
        <Notice kind={c.notice.ok ? "success" : "error"} className="mt-5">
          {c.notice.text}
        </Notice>
      )}
    </div>
  );
}

export default function Connections() {
  const [params] = useSearchParams();
  const conn = useConnections();
  const welcome = params.get("welcome") === "1";

  return (
    <>
      <PageMeta title="Bağlı Hesaplar · FyBlue" description={PAGE_TEXT.connections.subtitle} />
      <PageHeader title={PAGE_TEXT.connections.title} subtitle={PAGE_TEXT.connections.subtitle} crumbs={[{ title: "Ayarlar" }]} />

      <div className="space-y-6">
        {welcome && (
          <Notice kind="success" title="Hesabınız oluşturuldu.">
            Kullanmak istediğiniz modülün hesabını aşağıdan bağlayın — ikisini de bağlamak zorunda değilsiniz.
          </Notice>
        )}
        {conn.error && <Notice kind="error">{conn.error}</Notice>}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ConnectionCard system="osos" status={conn.osos} loaded={conn.loaded} />
          <ConnectionCard system="epias" status={conn.epias} loaded={conn.loaded} />
        </div>
      </div>
    </>
  );
}
