import { Card } from "@/components/ui/card";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import FullLogo from "src/layouts/full/shared/logo/FullLogo";
import { Notice } from "@/components/fyblue/ui";
import { TemplatePicker } from "@/components/fyblue/shell";
import { safeReturnUrl, useAuth, useLoginForm } from "@fyblue/core";

const BoxedLogin = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnUrl = params.get("returnUrl");
  const { isAuthenticated } = useAuth();
  const form = useLoginForm(() => navigate(safeReturnUrl(returnUrl), { replace: true }));

  if (isAuthenticated && !form.busy) return <Navigate to={safeReturnUrl(returnUrl)} replace />;

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-accent  px-4 py-8">
        <Card className="w-full max-w-md border-none shadow-lg p-6">
          {/* Logo */}
          <div className="mx-auto  w-fit">
            <FullLogo />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold">Giriş yap</h1>
            <p className="text-sm text-muted-foreground">FyBlue hesabınızla giriş yapın.</p>
          </div>

          <form className="space-y-6 w-full" onSubmit={form.submit}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-normal text-muted-foreground">
                  Kullanıcı adı*
                </Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  placeholder="Kullanıcı adınız"
                  value={form.username}
                  onChange={(e) => form.setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-normal text-muted-foreground">
                  Şifre*
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Şifreniz"
                  value={form.password}
                  onChange={(e) => form.setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-normal text-muted-foreground">Arayüz şablonu</Label>
                <TemplatePicker />
              </div>
            </div>
            <Notice kind="error">{form.error}</Notice>
            <Button type="submit" size="lg" className="w-full rounded-lg" disabled={form.busy}>
              {form.busy && <Spinner />}
              Giriş yap
            </Button>
          </form>
          {/* Footer */}
          <div className="flex gap-2 text-base font-medium mt-4 items-center justify-center">
            <p className="text-muted-foreground">Hesabınız yok mu?</p>
            <Link
              to={returnUrl ? `/signup?returnUrl=${encodeURIComponent(returnUrl)}` : "/signup"}
              className="text-primary/80 hover:text-primary text-sm font-medium"
            >
              Kayıt olun
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
};

export default BoxedLogin;
