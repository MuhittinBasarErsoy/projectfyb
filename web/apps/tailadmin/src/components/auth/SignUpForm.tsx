import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { TemplatePicker } from "@/components/fyblue/shell";
import { Notice, Spinner } from "@/components/fyblue/ui";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { PASSWORD_HINT, useAuth, useRegisterForm } from "@fyblue/core";
import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  // Yeni kullanıcının ilk işi dış hesapları bağlamak.
  const form = useRegisterForm(() => navigate("/settings/connections?welcome=1", { replace: true }));

  if (isAuthenticated && !form.busy) return <Navigate to="/" replace />;

  const returnUrl = params.get("returnUrl");
  const signInHref = returnUrl ? `/signin?returnUrl=${encodeURIComponent(returnUrl)}` : "/signin";

  return (
    <div className="no-scrollbar flex w-full flex-1 flex-col overflow-y-auto lg:w-1/2">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
              Kayıt ol
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tek hesap; OSOS ve EPİAŞ bağlantılarınızı sonra eklersiniz.
            </p>
          </div>
          <form onSubmit={form.submit}>
            <div className="space-y-5">
              <div>
                <Label>
                  Kullanıcı adı <span className="text-error-500">*</span>
                </Label>
                <Input
                  autoComplete="username"
                  autoFocus
                  value={form.username}
                  onChange={(e) => form.setUsername(e.target.value)}
                />
              </div>
              <div>
                <Label>E-posta</Label>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="ornek@firma.com"
                  value={form.email}
                  onChange={(e) => form.setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>
                  Şifre <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => form.setPassword(e.target.value)}
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-e-4 top-1/2 z-30 -translate-y-1/2 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                    )}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{PASSWORD_HINT}</p>
              </div>
              <div>
                <Label>
                  Şifre (tekrar) <span className="text-error-500">*</span>
                </Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password2}
                  onChange={(e) => form.setPassword2(e.target.value)}
                />
              </div>
              <div>
                <Label>Arayüz şablonu</Label>
                <TemplatePicker current="tailadmin" path="/signup" />
              </div>
              <Notice kind="error">{form.error}</Notice>
              <div>
                <Button className="w-full" size="sm" type="submit" disabled={form.busy}>
                  {form.busy && <Spinner />}
                  Kayıt ol
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-center text-sm font-normal text-gray-700 sm:text-start dark:text-gray-400">
              Zaten hesabınız var mı?{" "}
              <Link to={signInHref} className="text-brand-500 hover:text-brand-600 dark:text-brand-400">
                Giriş yapın
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
