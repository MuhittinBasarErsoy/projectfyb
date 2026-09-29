import PageMeta from "@/components/common/PageMeta";
import Checkbox from "@/components/form/input/Checkbox";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { Card, EmptyState, Notice, PageHeader, SkeletonRows, TextInput } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { MultiUserIcon, PlusIcon } from "@/icons";
import { CUSTOMER_PAGE_TEXT, useCustomerList } from "@fyblue/core";
import { Link, Navigate } from "react-router";
import CustomerForm from "./CustomerForm";

export default function CustomerList() {
  const l = useCustomerList();
  if (l.redirectTo) return <Navigate to={l.redirectTo} replace />;

  return (
    <>
      <PageMeta title="Müşteriler · FyBlue" description={CUSTOMER_PAGE_TEXT.list.subtitle} />
      <PageHeader
        title={CUSTOMER_PAGE_TEXT.list.title}
        subtitle={CUSTOMER_PAGE_TEXT.list.subtitle}
        crumbs={[{ title: "Müşteriler" }]}
        actions={
          l.canEdit && (
            <Button size="sm" onClick={l.form.startNew} startIcon={<PlusIcon className="size-5" />}>
              Yeni müşteri
            </Button>
          )
        }
      />

      <Card
        flush
        title="Müşteri listesi"
        actions={
          <>
            <Checkbox label="Pasifleri de göster" checked={l.includeInactive} onChange={l.setIncludeInactive} />
            <TextInput
              className="w-72"
              value={l.search}
              onChange={(e) => l.setSearch(e.target.value)}
              placeholder="Ünvan, kod veya vergi no ile ara…"
            />
          </>
        }
      >
        {l.error && (
          <div className="p-6 pb-0">
            <Notice kind="error">{l.error}</Notice>
          </div>
        )}
        {l.items === null ? (
          <div className="p-6">
            <SkeletonRows rows={4} />
          </div>
        ) : l.items.length === 0 ? (
          <EmptyState
            icon={<MultiUserIcon className="size-7" />}
            title={l.search ? "Eşleşen müşteri yok" : "Henüz müşteri yok"}
            text={l.canEdit && !l.search ? "“Yeni müşteri” ile ilk müşteri kartını oluşturun." : undefined}
          />
        ) : (
          <DataTable
            head={
              <>
                <Th>Kod</Th>
                <Th>Ünvan</Th>
                <Th>Vergi no</Th>
                <Th>Telefon</Th>
                <Th num>Tesisat</Th>
                <Th num>OSOS hesabı</Th>
                <Th>Durum</Th>
              </>
            }
          >
            {l.items.map((c) => (
              <Tr key={c.id}>
                <Td>{c.customerCode}</Td>
                <Td>
                  <Link to={`/customers/${c.id}`} className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90">
                    {c.title}
                  </Link>
                  {c.shortName && <span className="ms-2 text-theme-xs text-gray-400">{c.shortName}</span>}
                </Td>
                <Td>{c.taxNumber ?? "—"}</Td>
                <Td>{c.phone ?? "—"}</Td>
                <Td num>{c.installationCount}</Td>
                <Td num>{c.ososConnectionCount}</Td>
                <Td>
                  <Badge size="sm" color={c.isActive ? "success" : "light"}>
                    {c.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </Card>

      <CustomerForm f={l.form} />
    </>
  );
}
