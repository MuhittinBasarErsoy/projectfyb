import Checkbox from "@/components/form/input/Checkbox";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { Card, EmptyState, Field, IconButton, inputClass, Notice, SelectInput, SkeletonRows, Spinner, TextInput } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { BoxCubeIcon, PencilIcon, PlusIcon } from "@/icons";
import { cn } from "@/utils";
import {
  fmtKw,
  GENERATION_TYPES,
  generationTypeLabel,
  INSTALLATION_TYPES,
  installationTypeLabel,
  numberInputValue,
  parseNumberInput,
  PLANT_SUBTYPES,
  useInstallations,
  type GenerationType,
  type InstallationType,
  type ProductionSiteInfoDto,
} from "@fyblue/core";

/** Manuel değer girişinin altında OSOS kaynak değeri gösterilir (manuel boşsa kaynak geçerlidir). */
function SourceHint({ source }: { source?: string | null }) {
  return <span>OSOS: {source || "—"} · boş bırakılırsa OSOS değeri kullanılır</span>;
}

function NumberInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return <TextInput inputMode="decimal" value={numberInputValue(value)} onChange={(e) => onChange(parseNumberInput(e.target.value))} />;
}

function Options({ list }: { list: { value: string; label: string }[] }) {
  return (
    <>
      {list.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </>
  );
}

export default function InstallationsTab({ customerId }: { customerId: number }) {
  const t = useInstallations(customerId);
  const psi: ProductionSiteInfoDto = t.form.productionSiteInfo ?? {};
  const text = (key: keyof ProductionSiteInfoDto) => (e: React.ChangeEvent<HTMLInputElement>) => t.setPsi(key, e.target.value as never);
  const num = (key: keyof ProductionSiteInfoDto) => (v: number | null) => t.setPsi(key, v as never);

  return (
    <div className="space-y-6">
      {t.editing && (
        <Card title={t.editing.id ? "Tesisatı düzenle" : "Yeni tesisat"}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void t.save();
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Tesisat adı *">
                <TextInput value={t.form.name} onChange={(e) => t.set("name", e.target.value)} />
              </Field>
              <Field label="Tesisat tipi *">
                <SelectInput value={t.form.installationType} onChange={(v) => t.set("installationType", v as InstallationType)}>
                  <Options list={INSTALLATION_TYPES} />
                </SelectInput>
              </Field>
              {t.production && (
                <Field label="Üretim tipi *">
                  <SelectInput value={t.form.generationType ?? ""} onChange={(v) => t.set("generationType", (v || null) as GenerationType | null)}>
                    <option value="">— seçin —</option>
                    <Options list={GENERATION_TYPES} />
                  </SelectInput>
                </Field>
              )}
              <Field label="Dağıtım şirketi">
                <SelectInput value={String(t.form.distributionCompanyId ?? "")} onChange={(v) => t.set("distributionCompanyId", v ? Number(v) : null)}>
                  <option value="">— seçin —</option>
                  <Options list={t.distributionCompanies.map((o) => ({ value: String(o.id), label: o.name }))} />
                </SelectInput>
              </Field>
              <Field label="Kurulu güç (kW)" hint={<SourceHint source={t.source ? fmtKw(t.source.sourceInstalledPowerKw) : null} />}>
                <NumberInput value={t.form.manualInstalledPowerKw} onChange={(v) => t.set("manualInstalledPowerKw", v)} />
              </Field>
              <Field label="Sözleşme gücü (kW)" hint={<SourceHint source={t.source ? fmtKw(t.source.sourceContractPowerKw) : null} />}>
                <NumberInput value={t.form.manualContractPowerKw} onChange={(v) => t.set("manualContractPowerKw", v)} />
              </Field>
              <Field label="Adres" className="sm:col-span-2 lg:col-span-3" hint={<SourceHint source={t.source?.sourceAddress} />}>
                <textarea rows={2} className={cn(inputClass, "h-auto")} value={t.form.manualAddress ?? ""} onChange={(e) => t.set("manualAddress", e.target.value)} />
              </Field>
              <Field label="Gerilim seviyesi">
                <TextInput value={t.form.voltageLevel ?? ""} onChange={(e) => t.set("voltageLevel", e.target.value)} placeholder="ör. OG / AG" />
              </Field>
              <Field label="Sayaç tipi">
                <TextInput value={t.form.meterType ?? ""} onChange={(e) => t.set("meterType", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Enlem">
                  <NumberInput value={t.form.latitude} onChange={(v) => t.set("latitude", v)} />
                </Field>
                <Field label="Boylam">
                  <NumberInput value={t.form.longitude} onChange={(v) => t.set("longitude", v)} />
                </Field>
              </div>
            </div>

            {t.production && (
              <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Üretim teknik bilgileri</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Santral adı">
                    <TextInput value={psi.plantName ?? ""} onChange={text("plantName")} />
                  </Field>
                  {t.solar && (
                    <Field label="GES tipi">
                      <SelectInput value={psi.plantSubtype ?? ""} onChange={(v) => t.setPsi("plantSubtype", v || null)}>
                        <option value="">— seçin —</option>
                        <Options list={PLANT_SUBTYPES} />
                      </SelectInput>
                    </Field>
                  )}
                  <Field label="AC güç (kW)">
                    <NumberInput value={psi.acPowerKw} onChange={num("acPowerKw")} />
                  </Field>
                  <Field label="DC güç (kWp)">
                    <NumberInput value={psi.dcPowerKwp} onChange={num("dcPowerKwp")} />
                  </Field>
                  <Field label="Devreye alma tarihi">
                    <TextInput type="date" value={psi.commissioningDate ?? ""} onChange={(e) => t.setPsi("commissioningDate", e.target.value || null)} />
                  </Field>
                  {t.solar && (
                    <>
                      <Field label="Eğim (°) *">
                        <NumberInput value={psi.tiltDeg} onChange={num("tiltDeg")} />
                      </Field>
                      <Field label="Azimut (°) *" hint="Güney = 180">
                        <NumberInput value={psi.azimuthDeg} onChange={num("azimuthDeg")} />
                      </Field>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="İnverter marka">
                    <TextInput list="inverter-brands" value={psi.inverterBrand ?? ""} onChange={text("inverterBrand")} />
                  </Field>
                  <Field label="İnverter model">
                    <TextInput value={psi.inverterModel ?? ""} onChange={text("inverterModel")} />
                  </Field>
                  <Field label="İnverter adet">
                    <NumberInput value={psi.inverterQuantity} onChange={num("inverterQuantity")} />
                  </Field>
                  <Field label="İnverter birim güç (kW)">
                    <NumberInput value={psi.inverterUnitPowerKw} onChange={num("inverterUnitPowerKw")} />
                  </Field>
                  <Field label="Panel marka">
                    <TextInput list="panel-brands" value={psi.panelBrand ?? ""} onChange={text("panelBrand")} />
                  </Field>
                  <Field label="Panel model">
                    <TextInput value={psi.panelModel ?? ""} onChange={text("panelModel")} />
                  </Field>
                  <Field label="Panel adet">
                    <NumberInput value={psi.panelQuantity} onChange={num("panelQuantity")} />
                  </Field>
                  <Field label="Panel birim güç (Wp)">
                    <NumberInput value={psi.panelUnitPowerWp} onChange={num("panelUnitPowerWp")} />
                  </Field>
                  <Field label="Notlar" className="sm:col-span-2 lg:col-span-4">
                    <textarea rows={2} className={cn(inputClass, "h-auto")} value={psi.notes ?? ""} onChange={(e) => t.setPsi("notes", e.target.value)} />
                  </Field>
                </div>
                <datalist id="inverter-brands">
                  {t.inverterBrands.map((b) => (
                    <option key={b.id} value={b.name} />
                  ))}
                </datalist>
                <datalist id="panel-brands">
                  {t.panelBrands.map((b) => (
                    <option key={b.id} value={b.name} />
                  ))}
                </datalist>
              </div>
            )}

            <Checkbox label="Aktif" checked={t.form.isActive} onChange={(v) => t.set("isActive", v)} />
            {t.notice && <Notice kind={t.notice.ok ? "success" : "error"}>{t.notice.text}</Notice>}
            <div className="flex gap-3">
              <Button size="sm" type="submit" disabled={t.busy}>
                {t.busy && <Spinner />} Kaydet
              </Button>
              <Button size="sm" variant="outline" onClick={t.cancel}>
                Vazgeç
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        flush
        title="Tesisatlar"
        actions={
          <>
            <Checkbox label="Pasifleri de göster" checked={t.includeInactive} onChange={t.setIncludeInactive} />
            {t.canEdit && !t.editing && (
              <Button size="sm" onClick={t.startNew} startIcon={<PlusIcon className="size-5" />}>
                Yeni tesisat
              </Button>
            )}
          </>
        }
      >
        {!t.editing && t.notice && (
          <div className="p-6 pb-0">
            <Notice kind={t.notice.ok ? "success" : "error"}>{t.notice.text}</Notice>
          </div>
        )}
        {t.items === null ? (
          <div className="p-6">
            <SkeletonRows rows={3} />
          </div>
        ) : t.items.length === 0 ? (
          <EmptyState icon={<BoxCubeIcon className="size-7" />} title="Tesisat yok" text="Tesisat ekleyin veya OSOS aboneliğinden oluşturun." />
        ) : (
          <DataTable
            head={
              <>
                <Th>Ad</Th>
                <Th>Tip</Th>
                <Th>Dağıtım</Th>
                <Th num>Kurulu güç</Th>
                <Th num>Sözleşme gücü</Th>
                <Th>OSOS aboneliği</Th>
                <Th>Durum</Th>
                <Th />
              </>
            }
          >
            {t.items.map((i) => (
              <Tr key={i.id}>
                <Td>
                  <span className="font-medium text-gray-800 dark:text-white/90">{i.name}</span>
                  {i.effectiveAddress && <div className="max-w-xs truncate text-theme-xs text-gray-400">{i.effectiveAddress}</div>}
                </Td>
                <Td>
                  {installationTypeLabel(i.installationType)}
                  {i.generationType && <div className="text-theme-xs text-gray-400">{generationTypeLabel(i.generationType)}</div>}
                </Td>
                <Td>{i.distributionCompanyName ?? "—"}</Td>
                <Td num>
                  {fmtKw(i.effectiveInstalledPowerKw)}
                  {i.manualInstalledPowerKw != null && <div className="text-theme-xs text-gray-400">manuel</div>}
                </Td>
                <Td num>{fmtKw(i.effectiveContractPowerKw)}</Td>
                <Td>
                  {i.subscriptions.length === 0
                    ? "—"
                    : i.subscriptions.map((s) => (
                        <div key={s.id} className="text-theme-xs">
                          {s.identifierValue ? `Abone ${s.identifierValue}` : `#${s.subscriptionSerno}`}
                        </div>
                      ))}
                </Td>
                <Td>
                  <Badge size="sm" color={i.isActive ? "success" : "light"}>
                    {i.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </Td>
                <Td className="text-end">
                  {t.canEdit && (
                    <IconButton title="Düzenle" onClick={() => t.startEdit(i)}>
                      <PencilIcon className="size-5" />
                    </IconButton>
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
