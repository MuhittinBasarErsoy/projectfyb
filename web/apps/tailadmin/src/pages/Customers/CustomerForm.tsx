// Müşteri oluşturma/düzenleme penceresi (liste ve detay ekranı ortak).

import Checkbox from "@/components/form/input/Checkbox";
import { Field, inputClass, Notice, Spinner, TextInput } from "@/components/fyblue/ui";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/utils";
import { CUSTOMER_FIELDS, type useCustomerForm } from "@fyblue/core";

export default function CustomerForm({ f }: { f: ReturnType<typeof useCustomerForm> }) {
  return (
    <Modal isOpen={f.open} onClose={f.close} className="m-4 max-w-2xl p-6 lg:p-8">
      <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">{f.isEdit ? "Müşteriyi düzenle" : "Yeni müşteri"}</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void f.save();
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CUSTOMER_FIELDS.map((fd) => (
            <Field key={fd.key} label={fd.label + (fd.required ? " *" : "")} className={fd.wide ? "sm:col-span-2" : undefined}>
              {fd.multiline ? (
                <textarea
                  rows={2}
                  className={cn(inputClass, "h-auto")}
                  value={String(f.values[fd.key] ?? "")}
                  onChange={(e) => f.set(fd.key, e.target.value as never)}
                />
              ) : (
                <TextInput value={String(f.values[fd.key] ?? "")} onChange={(e) => f.set(fd.key, e.target.value as never)} />
              )}
            </Field>
          ))}
        </div>
        <Checkbox label="Aktif" checked={f.values.isActive} onChange={(v) => f.set("isActive", v)} />
        {f.notice && <Notice kind={f.notice.ok ? "success" : "error"}>{f.notice.text}</Notice>}
        <div className="flex justify-end gap-3">
          <Button size="sm" variant="outline" onClick={f.close}>
            Vazgeç
          </Button>
          <Button size="sm" type="submit" disabled={f.busy}>
            {f.busy && <Spinner />} Kaydet
          </Button>
        </div>
      </form>
    </Modal>
  );
}
