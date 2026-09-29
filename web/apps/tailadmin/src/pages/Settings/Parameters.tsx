import PageMeta from "@/components/common/PageMeta";
import Checkbox from "@/components/form/input/Checkbox";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { Card, EmptyState, Field, IconButton, Notice, PageHeader, SkeletonRows, Spinner, TextInput } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { ListIcon, LockIcon, PencilIcon, PlusIcon } from "@/icons";
import { cn } from "@/utils";
import { CUSTOMER_PAGE_TEXT, PARAMETER_GROUP_HINTS, useParametersAdmin } from "@fyblue/core";

export default function Parameters() {
  const p = useParametersAdmin();
  const g = p.group;

  return (
    <>
      <PageMeta title="Parametreler · FyBlue" description={CUSTOMER_PAGE_TEXT.parameters.subtitle} />
      <PageHeader title={CUSTOMER_PAGE_TEXT.parameters.title} subtitle={CUSTOMER_PAGE_TEXT.parameters.subtitle} crumbs={[{ title: "Ayarlar" }]} />

      {p.readOnly && <Notice kind="warning">Parametreleri yalnızca danışmanlar değiştirebilir.</Notice>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
        <Card flush title="Gruplar">
          {p.groups === null ? (
            <div className="p-6">
              <SkeletonRows rows={4} />
            </div>
          ) : (
            <ul className="p-2">
              {p.groups.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => p.setGroupId(x.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-theme-sm",
                      x.id === p.groupId
                        ? "bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5",
                    )}
                  >
                    {x.name}
                    <span className="text-theme-xs text-gray-400">{x.values.filter((v) => v.isActive).length}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {p.editing && g && (
            <Card title={p.editing.id ? "Değeri düzenle" : `${g.name}: yeni değer`}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void p.save();
                }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Kod *" hint={p.editing.isSystem ? "Sistem kaydı: kod değiştirilemez" : "Büyük harfe çevrilir"}>
                    <TextInput value={p.form.code} disabled={p.editing.isSystem} onChange={(e) => p.set("code", e.target.value)} />
                  </Field>
                  <Field label="Ad *">
                    <TextInput value={p.form.name} onChange={(e) => p.set("name", e.target.value)} />
                  </Field>
                  <Field label="Açıklama">
                    <TextInput value={p.form.description ?? ""} onChange={(e) => p.set("description", e.target.value)} />
                  </Field>
                  <Field label="Sıra">
                    <TextInput type="number" value={p.form.sortOrder} onChange={(e) => p.set("sortOrder", Number(e.target.value))} />
                  </Field>
                </div>
                {!p.editing.isSystem && <Checkbox label="Aktif" checked={p.form.isActive} onChange={(v) => p.set("isActive", v)} />}
                {p.notice && <Notice kind={p.notice.ok ? "success" : "error"}>{p.notice.text}</Notice>}
                <div className="flex gap-3">
                  <Button size="sm" type="submit" disabled={p.busy}>
                    {p.busy && <Spinner />} Kaydet
                  </Button>
                  <Button size="sm" variant="outline" onClick={p.cancel}>
                    Vazgeç
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card
            flush
            title={g?.name ?? "Değerler"}
            desc={g ? PARAMETER_GROUP_HINTS[g.code] : undefined}
            actions={
              p.canEdit &&
              g &&
              !p.editing && (
                <Button size="sm" onClick={p.startNew} startIcon={<PlusIcon className="size-5" />}>
                  Değer ekle
                </Button>
              )
            }
          >
            {!p.editing && p.notice && (
              <div className="p-6 pb-0">
                <Notice kind={p.notice.ok ? "success" : "error"}>{p.notice.text}</Notice>
              </div>
            )}
            {!g ? (
              <div className="p-6">
                <SkeletonRows rows={4} />
              </div>
            ) : g.values.length === 0 ? (
              <EmptyState icon={<ListIcon className="size-7" />} title="Bu grupta değer yok" />
            ) : (
              <DataTable
                head={
                  <>
                    <Th num>Sıra</Th>
                    <Th>Kod</Th>
                    <Th>Ad</Th>
                    <Th>Açıklama</Th>
                    <Th>Durum</Th>
                    <Th />
                  </>
                }
              >
                {g.values.map((v) => (
                  <Tr key={v.id}>
                    <Td num>{v.sortOrder}</Td>
                    <Td>
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-theme-xs dark:bg-white/5">{v.code}</code>
                      {v.isSystem && <LockIcon className="ms-1.5 inline size-3.5 fill-current text-gray-400" />}
                    </Td>
                    <Td>
                      <span className="font-medium text-gray-800 dark:text-white/90">{v.name}</span>
                    </Td>
                    <Td>{v.description ?? "—"}</Td>
                    <Td>
                      <Badge size="sm" color={v.isActive ? "success" : "light"}>
                        {v.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </Td>
                    <Td className="text-end">
                      {p.canEdit && (
                        <div className="inline-flex items-center gap-2">
                          {!v.isSystem && (
                            <Button size="xs" variant="outline" disabled={p.busy} onClick={() => p.toggleActive(v)}>
                              {v.isActive ? "Pasife al" : "Aktifleştir"}
                            </Button>
                          )}
                          <IconButton title="Düzenle" onClick={() => p.startEdit(v)}>
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
        </div>
      </div>
    </>
  );
}
