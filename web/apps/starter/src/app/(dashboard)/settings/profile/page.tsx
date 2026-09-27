'use client';

import PageContainer from '@/components/layout/page-container';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { TemplatePicker } from "@/components/fyblue/shell";
import { Notice, PageHeader, Section, SkeletonRows } from "@/components/fyblue/ui";
import { fmtLongDate, PAGE_TEXT, useAuth, useProfile } from "@fyblue/core";
import { IconLogout, IconPlugConnected } from "@tabler/icons-react";
import Link from "next/link";

export default function Profile() {
  const { username, initial, signOut } = useAuth();
  const { profile, error, loading } = useProfile();

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
      <PageHeader title={PAGE_TEXT.profile.title} subtitle={PAGE_TEXT.profile.subtitle} items={[{ title: "Ayarlar" }]} />
      <Notice kind="error">{error}</Notice>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section>
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">{initial}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-base font-semibold">{profile?.username ?? username}</h3>
              <span className="text-muted-foreground text-sm">{profile?.email ?? "E-posta yok"}</span>
            </div>
          </div>
          {loading ? (
            <SkeletonRows rows={2} />
          ) : profile ? (
            <dl className="bg-muted/50 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 border p-3 text-sm">
              <dt className="text-muted-foreground">Kullanıcı adı</dt>
              <dd className="font-medium">{profile.username}</dd>
              <dt className="text-muted-foreground">E-posta</dt>
              <dd className="font-medium">{profile.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Üyelik</dt>
              <dd className="font-medium">{fmtLongDate(profile.createdAt)}</dd>
            </dl>
          ) : null}
        </Section>

        <Section
          title="Oturum"
          description="Çıkış yaptığınızda bu tarayıcıdaki oturum kapanır. Bağlı OSOS/EPİAŞ hesaplarınız ve zamanlanmış işleriniz etkilenmez."
        >
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/connections" className={buttonVariants({ variant: "outline" })}>
              <IconPlugConnected /> Bağlı hesaplar
            </Link>
            <Button variant="destructive" onClick={signOut}>
              <IconLogout /> Çıkış yap
            </Button>
          </div>
        </Section>
      </div>

      <Section title="Arayüz şablonu" description="Seçim bu tarayıcıda saklanır. Oturumunuz açık kalır; aynı sayfa seçtiğiniz şablonla açılır.">
        <div className="max-w-xl">
          <TemplatePicker path="/settings/profile" />
        </div>
      </Section>
    </div>
      </PageContainer>
  );
}
