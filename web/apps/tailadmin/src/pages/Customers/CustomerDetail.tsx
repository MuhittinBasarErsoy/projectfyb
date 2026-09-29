import PageMeta from "@/components/common/PageMeta";
import { Notice, PageHeader, Segmented, SkeletonRows } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { PencilIcon } from "@/icons";
import { useCurrentUser, useCustomerDetail } from "@fyblue/core";
import { useParams } from "react-router";
import CustomerForm from "./CustomerForm";
import DocumentsTab from "./tabs/DocumentsTab";
import InstallationsTab from "./tabs/InstallationsTab";
import IntegrationTab from "./tabs/IntegrationTab";
import OsosDataTab from "./tabs/OsosDataTab";
import SummaryTab from "./tabs/SummaryTab";
import UsersTab from "./tabs/UsersTab";

export default function CustomerDetail() {
  const id = Number(useParams().id);
  const d = useCustomerDetail(id);
  const user = useCurrentUser();
  const c = d.customer;

  return (
    <>
      <PageMeta title={`${c?.title ?? "Müşteri"} · FyBlue`} description="Müşteri detayı" />
      <PageHeader
        title={c?.title ?? "Müşteri"}
        subtitle={
          c && (
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge size="sm" color={c.isActive ? "success" : "light"}>
                {c.isActive ? "Aktif" : "Pasif"}
              </Badge>
              Kod: {c.customerCode}
              {c.taxNumber && ` · VKN: ${c.taxNumber}`}
            </span>
          )
        }
        crumbs={user.isConsultant ? [{ title: "Müşteriler", to: "/customers" }] : [{ title: "Firma Bilgilerim" }]}
        actions={
          d.canEdit &&
          c && (
            <Button size="sm" variant="outline" onClick={() => d.form.startEdit(c)} startIcon={<PencilIcon className="size-5" />}>
              Düzenle
            </Button>
          )
        }
      />

      {d.error && <Notice kind="error">{d.error}</Notice>}
      {!d.summary && !d.error && <SkeletonRows rows={5} />}

      {d.summary && (
        <div className="space-y-6">
          <Segmented value={d.tab} onChange={d.setTab} options={d.tabs.map((t) => ({ value: t.key, label: t.label }))} />
          {d.tab === "summary" && <SummaryTab s={d.summary} onGo={d.setTab} />}
          {d.tab === "installations" && <InstallationsTab customerId={id} />}
          {(d.tab === "consumption" || d.tab === "production" || d.tab === "endex") && (
            <OsosDataTab key={d.tab} customerId={id} kind={d.tab} />
          )}
          {d.tab === "documents" && <DocumentsTab key="docs" customerId={id} />}
          {d.tab === "invoices" && <DocumentsTab key="inv" customerId={id} invoices />}
          {d.tab === "osos" && <IntegrationTab customerId={id} />}
          {d.tab === "users" && <UsersTab customerId={id} />}
        </div>
      )}

      <CustomerForm f={d.form} />
    </>
  );
}
