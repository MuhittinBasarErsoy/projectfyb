import { Card } from "@/components/ui/card";
import { Link, Navigate, useNavigate } from "react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import FullLogo from "src/layouts/full/shared/logo/FullLogo";
import { Notice } from "@/components/fyblue/ui";
import { TemplatePicker } from "@/components/fyblue/shell";
import { PASSWORD_HINT, useAuth, useRegisterForm } from "@fyblue/core";
import type { ReactNode } from "react";

function Row({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const BoxedRegister = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  // Yeni kullanıcının ilk işi dış hesapları bağlamak.
  const form = useRegisterForm(() => navigate("/settings/connections?welcome=1", { replace: true }));

  if (isAuthenticated && !form.busy) return <Navigate to="/" replace />;

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-accent  px-4 py-8">
        <Card className="w-full max-w-md border-none shadow-lg p-6">
          <div className="mx-auto  w-fit">
            <FullLogo />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold">Hesap oluşturun</h1>
            <p className="text-sm text-muted-foreground">Tek hesap; OSOS ve EPİAŞ bağlantılarınızı sonra eklersiniz.</p>
          </div>

          <form className="space-y-6 w-full" onSubmit={form.submit}>
            <div className="space-y-4">
              <Row id="username" label="Kullanıcı adı*">
                <Input id="username" autoComplete="username" autoFocus value={form.username} onChange={(e) => form.setUsername(e.target.value)} />
              </Row>
              <Row id="email" label="E-posta">
                <Input id="email" type="email" autoComplete="email" placeholder="ornek@firma.com" value={form.email} onChange={(e) => form.setEmail(e.target.value)} />
              </Row>
              <Row id="password" label="Şifre*" hint={PASSWORD_HINT}>
                <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => form.setPassword(e.target.value)} />
              </Row>
              <Row id="password2" label="Şifre (tekrar)*">
                <Input id="password2" type="password" autoComplete="new-password" value={form.password2} onChange={(e) => form.setPassword2(e.target.value)} />
              </Row>
              <Row label="Arayüz şablonu">
                <TemplatePicker path="/signup" />
              </Row>
            </div>
            <Notice kind="error">{form.error}</Notice>
            <Button type="submit" size="lg" className="w-full rounded-lg" disabled={form.busy}>
              {form.busy && <Spinner />}
              Kayıt ol
            </Button>
          </form>
          <div className="flex gap-2 text-base font-medium mt-4 items-center justify-center">
            <p className="text-muted-foreground">Zaten hesabınız var mı?</p>
            <Link to="/signin" className="text-primary/80 hover:text-primary text-sm font-medium">
              Giriş yapın
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
};

export default BoxedRegister;
