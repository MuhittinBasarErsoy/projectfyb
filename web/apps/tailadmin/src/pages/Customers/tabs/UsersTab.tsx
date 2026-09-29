import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { Card, EmptyState, Field, IconButton, Notice, SkeletonRows, Spinner, TextInput } from "@/components/fyblue/ui";
import Button from "@/components/ui/button/Button";
import { GroupIcon, PlusIcon, TrashBinIcon } from "@/icons";
import { fmtDateTime, PASSWORD_HINT, useCustomerUsers } from "@fyblue/core";

export default function UsersTab({ customerId }: { customerId: number }) {
  const u = useCustomerUsers(customerId);

  return (
    <div className="space-y-6">
      <Card title="Müşteri kullanıcısı ekle" desc="Bu kullanıcı giriş yapınca yalnızca bu müşterinin verilerini görür; belge yükleyebilir ama silemez.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void u.create();
          }}
          className="space-y-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Kullanıcı adı *">
              <TextInput autoComplete="off" value={u.username} onChange={(e) => u.setUsername(e.target.value)} />
            </Field>
            <Field label="E-posta">
              <TextInput type="email" value={u.email} onChange={(e) => u.setEmail(e.target.value)} />
            </Field>
            <Field label="Şifre *" hint={PASSWORD_HINT}>
              <TextInput type="password" autoComplete="new-password" value={u.password} onChange={(e) => u.setPassword(e.target.value)} />
            </Field>
          </div>
          {u.notice && <Notice kind={u.notice.ok ? "success" : "error"}>{u.notice.text}</Notice>}
          <Button size="sm" type="submit" disabled={u.busy} startIcon={u.busy ? <Spinner /> : <PlusIcon className="size-5" />}>
            Kullanıcı oluştur
          </Button>
        </form>
      </Card>

      <Card flush title="Kullanıcılar">
        {u.users === null ? (
          <div className="p-6">
            <SkeletonRows rows={2} />
          </div>
        ) : u.users.length === 0 ? (
          <EmptyState icon={<GroupIcon className="size-7" />} title="Bu müşteriye bağlı kullanıcı yok" />
        ) : (
          <DataTable
            head={
              <>
                <Th>Kullanıcı adı</Th>
                <Th>E-posta</Th>
                <Th>Oluşturulma</Th>
                <Th />
              </>
            }
          >
            {u.users.map((x) => (
              <Tr key={x.id}>
                <Td>
                  <span className="font-medium text-gray-800 dark:text-white/90">{x.username}</span>
                </Td>
                <Td>{x.email ?? "—"}</Td>
                <Td>{fmtDateTime(x.createdAt)}</Td>
                <Td className="text-end">
                  <IconButton title="Sil" danger onClick={() => u.remove(x)}>
                    <TrashBinIcon className="size-5" />
                  </IconButton>
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
