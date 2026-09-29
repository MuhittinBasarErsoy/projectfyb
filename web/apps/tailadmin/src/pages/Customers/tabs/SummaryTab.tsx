import { Card, MiniStat, Notice } from "@/components/fyblue/ui";
import { fmtDateTime, fmtKw, type CustomerSummaryDto, type CustomerTab } from "@fyblue/core";

function KV({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium break-words text-gray-800 dark:text-white/90">{value || "—"}</p>
    </div>
  );
}

export default function SummaryTab({ s, onGo }: { s: CustomerSummaryDto; onGo: (t: CustomerTab) => void }) {
  const c = s.customer;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <button type="button" className="text-start" onClick={() => onGo("installations")}>
          <MiniStat value={s.installationCount} label={`Tesisat (${s.consumptionInstallationCount} tüketim · ${s.productionInstallationCount} üretim)`} />
        </button>
        <MiniStat value={fmtKw(s.totalInstalledPowerKw)} label="Toplam kurulu güç" />
        <MiniStat value={fmtKw(s.totalContractPowerKw)} label="Toplam sözleşme gücü" />
        <button type="button" className="text-start" onClick={() => onGo("osos")}>
          <MiniStat value={s.subscriptionCount} label={`OSOS aboneliği (${s.ososConnectionCount} hesap)`} />
        </button>
        <button type="button" className="text-start" onClick={() => onGo("documents")}>
          <MiniStat value={s.documentCount} label="Belge" />
        </button>
        <button type="button" className="text-start" onClick={() => onGo("invoices")}>
          <MiniStat value={s.invoiceCount} label="Fatura" />
        </button>
      </div>

      {s.unmatchedSubscriptionCount > 0 && (
        <Notice kind="warning">
          {s.unmatchedSubscriptionCount} OSOS aboneliği henüz bir tesisata eşleşmemiş.{" "}
          <button type="button" className="font-medium text-brand-500 underline" onClick={() => onGo("osos")}>
            OSOS / Entegrasyon →
          </button>
        </Notice>
      )}

      <Card title="Firma bilgileri" desc={s.lastSyncAt ? `Son OSOS senkronizasyonu: ${fmtDateTime(s.lastSyncAt)}` : undefined}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <KV label="Ünvan" value={c.title} />
          <KV label="Kısa ad" value={c.shortName} />
          <KV label="Müşteri kodu" value={c.customerCode} />
          <KV label="Vergi no / dairesi" value={[c.taxNumber, c.taxOffice].filter(Boolean).join(" · ")} />
          <KV label="Yetkili" value={c.authorizedPerson} />
          <KV label="Telefon" value={c.phone} />
          <KV label="E-posta" value={c.email} />
          <KV label="Adres" value={c.address} />
          <KV label="Notlar" value={c.notes} />
        </div>
      </Card>
    </div>
  );
}
