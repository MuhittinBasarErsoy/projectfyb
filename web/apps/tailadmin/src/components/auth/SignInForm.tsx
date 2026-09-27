import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { TemplatePicker } from "@/components/fyblue/shell";
import { Notice, Spinner } from "@/components/fyblue/ui";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { safeReturnUrl, useAuth, useLoginForm } from "@fyblue/core";
import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnUrl = params.get("returnUrl");
  const { isAuthenticated } = useAuth();
  const form = useLoginForm(() => navigate(safeReturnUrl(returnUrl), { replace: true }));

  if (isAuthenticated && !form.busy) return <Navigate to={safeReturnUrl(returnUrl)} replace />;

  const signUpHref = returnUrl ? `/signup?returnUrl=${encodeURIComponent(returnUrl)}` : "/signup";

  return (
    <div className="flex flex-1 flex-col lg:w-1/2">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
              Giriş yap
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">FyBlue hesabınızın kullanıcı adı ve şifresiyle giriş yapın.</p>
          </div>
          <div>
            <form onSubmit={form.submit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    Kullanıcı adı <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input
                    placeholder="kullanici"
                    autoComplete="username"
                    autoFocus
                    value={form.username}
                    onChange={(e) => form.setUsername(e.target.value)}
                  />
                </div>
                <div>
                  <Label>
                    Şifre <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Şifrenizi girin"
                      autoComplete="current-password"
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
                </div>
                <div>
                  <Label>Arayüz şablonu</Label>
                  <TemplatePicker current="tailadmin" />
                </div>
                <Notice kind="error">{form.error}</Notice>
                <div>
                  <Button className="w-full" size="sm" type="submit" disabled={form.busy}>
                    {form.busy && <Spinner />}
                    Giriş yap
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-center text-sm font-normal text-gray-700 sm:text-start dark:text-gray-400">
                Hesabınız yok mu?{" "}
                <Link to={signUpHref} className="text-brand-500 hover:text-brand-600 dark:text-brand-400">
                  Kayıt olun
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
