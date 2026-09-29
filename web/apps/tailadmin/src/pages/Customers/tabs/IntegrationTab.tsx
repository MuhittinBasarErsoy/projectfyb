import Checkbox from "@/components/form/input/Checkbox";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { Card, EmptyState, Field, IconButton, Notice, SelectInput, SkeletonRows, Spinner, TextInput } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { PencilIcon, PlugInIcon, PlusIcon, RegenerateIcon } from "@/icons";
import { fmtDateTime, fmtKw, useOsosIntegration } from "@fyblue/core";

export default function IntegrationTab({ customerId }: { customerId: number }) {
  const o = useOsosIntegration(customerId);

  return (
    <div className="space-y-6">
      {o.notice && <Notice kind={o.notice.ok ? "success" : "error"}>{o.notice.text}</Notice>}

      {o.editing && (
        <Card title={o.editing.id ? "OSOS bağlantısını düzenle" : "Yeni OSOS bağlantısı"} desc="Müşterinin OSOS portal kullanıcı kodu ve şifresi. Şifre şifrelenmiş saklanır.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void o.save();
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Bağlantı adı">
                <TextInput value={o.form.connectionName ?? ""} onChange={(e) => o.set("connectionName", e.target.value)} placeholder="ör. Ana hesap" />
              </Field>
              <Field label="Dağıtım şirketi">
                <SelectInput value={String(o.form.distributionCompanyId ?? "")} onChange={(v) => o.set("distributionCompanyId", v ? Number(v) : null)}>
                  <option value="">— seçin —</option>
                  {o.distributionCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="OSOS kullanıcı kodu *">
                <TextInput autoComplete="off" value={o.form.username} onChange={(e) => o.set("username", e.target.value)} />
              </Field>
              <Field label={o.editing.id ? "Şifre (değiştirmek için)" : "Şifre *"}>
                <TextInput type="password" autoComplete="new-password" value={o.form.password ?? ""} onChange={(e) => o.set("password", e.target.value)} />
              </Field>
            </div>
            <Checkbox label="Aktif (günlük senkronizasyona dahil)" checked={o.form.isActive} onChange={(v) => o.set("isActive", v)} />
            <div className="flex gap-3">
              <Button size="sm" type="submit" disabled={o.busy}>
                {o.busy && <Spinner />} Kaydet
              </Button>
              <Button size="sm" variant="outline" onClick={o.cancel}>
                Vazgeç
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        flush
        title="OSOS bağlantıları"
        desc="Bir OSOS hesabı birden çok abonelik getirebilir. Senkronizasyon her gün otomatik de çalışır."
        actions={
          o.canEdit &&
          !o.editing && (
            <Button size="sm" onClick={o.startNew} startIcon={<PlusIcon className="size-5" />}>
              Bağlantı ekle
            </Button>
          )
        }
      >
        {o.connections === null ? (
          <div className="p-6">
            <SkeletonRows rows={2} />
          </div>
        ) : o.connections.length === 0 ? (
          <EmptyState icon={<PlugInIcon className="size-7" />} title="OSOS bağlantısı yok" />
        ) : (
          <DataTable
            head={
              <>
                <Th>Bağlantı</Th>
                <Th>Dağıtım</Th>
                <Th num>Abonelik</Th>
                <Th>Son durum</Th>
                <Th>Son senkron</Th>
                <Th />
              </>
            }
          >
            {o.connections.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <span className="font-medium text-gray-800 dark:text-white/90">{c.connectionName ?? c.username}</span>
                  <div className="text-theme-xs text-gray-400">
                    {c.username}
                    {!c.isActive && " · pasif"}
                  </div>
                </Td>
                <Td>{c.distributionCompanyName ?? "—"}</Td>
                <Td num>{c.subscriptionCount}</Td>
                <Td className="max-w-xs truncate" >
                  <span title={c.lastConnectionStatus ?? ""}>{c.lastConnectionStatus ?? "—"}</span>
                </Td>
                <Td>{fmtDateTime(c.lastSyncAt)}</Td>
                <Td className="text-end">
                  {o.canEdit && (
                    <div className="inline-flex items-center gap-2">
                      <Button size="xs" variant="outline" disabled={o.busy} onClick={() => o.test(c)}>
                        Test et
                      </Button>
                      <Button size="xs" disabled={o.busy} onClick={() => o.sync(c)} startIcon={<RegenerateIcon className="size-4" />}>
                        Senkronize et
                      </Button>
                      <IconButton title="Düzenle" onClick={() => o.startEdit(c)}>
                        <PencilIcon className="size-5" />
                      </IconButton>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Card
        flush
        title={`OSOS abonelikleri (${o.subscriptionCount})`}
        desc={o.unmatchedCount > 0 ? `${o.unmatchedCount} abonelik bir tesisata eşleşmemiş.` : "Tüm abonelikler tesisatlara eşleşmiş."}
        actions={<TextInput className="w-64" value={o.subsQuery} onChange={(e) => o.setSubsQuery(e.target.value)} placeholder="Ünvan, abone no, serno…" />}
      >
        {o.subscriptions === null ? (
          <div className="p-6">
            <SkeletonRows rows={3} />
          </div>
        ) : o.subscriptions.length === 0 ? (
          <EmptyState icon={<PlugInIcon className="size-7" />} title="Abonelik yok" text={o.subscriptionCount ? "Aramaya uyan abonelik yok." : "Bağlantı ekleyip “Senkronize et”e basın."} />
        ) : (
          <DataTable
            maxHeight={560}
            head={
              <>
                <Th>Ünvan / adres</Th>
                <Th>Abone no</Th>
                <Th>Sayaç</Th>
                <Th num>Kurulu / sözleşme</Th>
                <Th>Tesisat</Th>
              </>
            }
          >
            {o.subscriptions.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <span className="font-medium text-gray-800 dark:text-white/90">{s.sourceTitle ?? "—"}</span>
                  {s.sourceAddress && <div className="max-w-sm truncate text-theme-xs text-gray-400">{s.sourceAddress}</div>}
                </Td>
                <Td>
                  {s.identifierValue ?? "—"}
                  <div className="text-theme-xs text-gray-400">#{s.subscriptionSerno}</div>
                </Td>
                <Td>
                  {s.meterSerial ?? "—"}
                  {s.multiplier != null && <div className="text-theme-xs text-gray-400">çarpan {s.multiplier}</div>}
                </Td>
                <Td num>
                  {fmtKw(s.installedPowerKw)}
                  <div className="text-theme-xs text-gray-400">{fmtKw(s.contractPowerKw)}</div>
                </Td>
                <Td>
                  {o.canEdit ? (
                    <div className="flex items-center gap-2">
                      <SelectInput
                        className="w-56"
                        value={String(s.installationId ?? "")}
                        onChange={(v) => o.link(s, v ? Number(v) : null)}
                      >
                        <option value="">— eşleşmemiş —</option>
                        {o.installations.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </SelectInput>
                      {!s.installationId && (
                        <Button size="xs" variant="outline" disabled={o.busy} onClick={() => o.createInstallation(s)}>
                          Tesisat oluştur
                        </Button>
                      )}
                    </div>
                  ) : s.installationName ? (
                    s.installationName
                  ) : (
                    <Badge size="sm" color="light">
                      eşleşmemiş
                    </Badge>
                  )}
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
