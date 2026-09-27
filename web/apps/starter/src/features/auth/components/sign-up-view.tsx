'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { TemplatePicker } from '@/components/fyblue/shell';
import { Notice } from '@/components/fyblue/ui';
import { PASSWORD_HINT, useAuth, useRegisterForm } from '@fyblue/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AuthShell } from './sign-in-view';

function Row({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </div>
  );
}

export default function SignUpViewPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  // Yeni kullanıcının ilk işi dış hesapları bağlamak.
  const form = useRegisterForm(() => router.replace('/settings/connections/?welcome=1'));

  useEffect(() => {
    if (isAuthenticated && !form.busy) router.replace('/');
  }, [isAuthenticated, form.busy, router]);

  return (
    <AuthShell>
      <title>Kayıt · FyBlue</title>
      <div className='flex flex-col space-y-2 text-center'>
        <h1 className='text-2xl font-semibold tracking-tight'>Hesap oluşturun</h1>
        <p className='text-muted-foreground text-sm'>Tek hesap; OSOS ve EPİAŞ bağlantılarınızı sonra eklersiniz.</p>
      </div>
      <form onSubmit={form.submit} className='grid w-full gap-4'>
        <Row id='username' label='Kullanıcı adı'>
          <Input id='username' autoComplete='username' autoFocus value={form.username} onChange={(e) => form.setUsername(e.target.value)} />
        </Row>
        <Row id='email' label='E-posta'>
          <Input id='email' type='email' autoComplete='email' placeholder='ornek@firma.com' value={form.email} onChange={(e) => form.setEmail(e.target.value)} />
        </Row>
        <Row id='password' label='Şifre' hint={PASSWORD_HINT}>
          <Input id='password' type='password' autoComplete='new-password' value={form.password} onChange={(e) => form.setPassword(e.target.value)} />
        </Row>
        <Row id='password2' label='Şifre (tekrar)'>
          <Input id='password2' type='password' autoComplete='new-password' value={form.password2} onChange={(e) => form.setPassword2(e.target.value)} />
        </Row>
        <Row label='Arayüz şablonu'>
          <TemplatePicker path='/signup' />
        </Row>
        <Notice kind='error'>{form.error}</Notice>
        <Button type='submit' disabled={form.busy} className='w-full'>
          {form.busy && <Spinner />}
          Kayıt ol
        </Button>
      </form>
      <p className='text-muted-foreground px-8 text-center text-sm'>
        Zaten hesabınız var mı?{' '}
        <Link href='/signin/' className='hover:text-primary underline underline-offset-4'>
          Giriş yapın
        </Link>
      </p>
    </AuthShell>
  );
}
