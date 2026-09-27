import PageMeta from "@/components/common/PageMeta";
import { TemplatePicker } from "@/components/fyblue/shell";
import { Card, Notice, PageHeader, SkeletonRows } from "@/components/fyblue/ui";
import Button from "@/components/ui/button/Button";
import { LogoutIcon, PlugInIcon } from "@/icons";
import { fmtLongDate, PAGE_TEXT, useAuth, useProfile } from "@fyblue/core";
import { Link } from "react-router";

export default function Profile() {
  const { username, initial, signOut } = useAuth();
  const { profile, error, loading } = useProfile();

  return (
    <>
      <PageMeta title="Profil · FyBlue" description={PAGE_TEXT.profile.subtitle} />
      <PageHeader title={PAGE_TEXT.profile.title} subtitle={PAGE_TEXT.profile.subtitle} crumbs={[{ title: "Ayarlar" }]} />

      <div className="space-y-6">
        <Notice kind="error">{error}</Notice>

        {/* UserMetaCard düzeni */}
        <div className="rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex w-full flex-col items-center gap-6 xl:flex-row">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-brand-500 text-3xl font-semibold text-white dark:border-gray-800">
                {initial}
              </div>
              <div className="order-3 xl:order-2">
                <h4 className="mb-2 text-center text-lg font-semibold text-gray-800 xl:text-left dark:text-white/90">
                  {profile?.username ?? username}
                </h4>
                <p className="text-center text-sm text-gray-500 xl:text-left dark:text-gray-400">
                  {profile?.email ?? "E-posta yok"}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            {loading ? (
              <SkeletonRows rows={2} />
            ) : profile ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-7 2xl:gap-x-32">
                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Kullanıcı adı</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">{profile.username}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">E-posta</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">{profile.email ?? "—"}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Üyelik</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">{fmtLongDate(profile.createdAt)}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <Card title="Arayüz şablonu" desc="Seçim bu tarayıcıda saklanır. Oturumunuz açık kalır; aynı sayfa seçtiğiniz şablonla açılır.">
          <TemplatePicker current="tailadmin" path="/settings/profile" />
        </Card>

        <Card
          title="Oturum"
          desc="Çıkış yaptığınızda bu tarayıcıdaki oturum kapanır. Bağlı OSOS/EPİAŞ hesaplarınız ve zamanlanmış işleriniz etkilenmez."
        >
          <div className="flex flex-wrap gap-3">
            <Link
              to="/settings/connections"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
            >
              <PlugInIcon className="size-5" /> Bağlı hesaplar
            </Link>
            <Button size="sm" variant="danger" onClick={signOut} startIcon={<LogoutIcon className="size-5 fill-current" />}>
              Çıkış yap
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
