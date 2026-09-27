'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { TemplatePicker } from '@/components/fyblue/shell';
import { Notice } from '@/components/fyblue/ui';
import { cn } from '@/lib/utils';
import { safeReturnUrl, useAuth, useLoginForm } from '@fyblue/core';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { InteractiveGridPattern } from './interactive-grid';

/** Şablonun iki sütunlu kimlik ekranı: solda marka paneli, sağda form. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='relative hidden h-full flex-col p-10 lg:flex dark:border-r'>
        <div className='bg-sidebar absolute inset-0' />
        <div className='text-sidebar-foreground relative z-20 flex items-center text-lg font-medium'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='mr-2 h-6 w-6'
          >
            <path d='M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3' />
          </svg>
          FyBlue
        </div>
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
            'inset-x-0 inset-y-[0%] h-full skew-y-12'
          )}
        />
        <div className='text-sidebar-foreground relative z-20 mt-auto'>
          <blockquote className='space-y-2'>
            <p className='text-lg'>
              &ldquo;OSOS sayaç verileri ve EPİAŞ Şeffaflık Platformu tek hesapla, tek panelde.&rdquo;
            </p>
            <footer className='text-sidebar-foreground/70 text-sm'>Tüketim, endeks, 160+ EPİAŞ servisi ve formüller</footer>
          </blockquote>
        </div>
      </div>
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-md flex-col items-center justify-center space-y-6'>{children}</div>
      </div>
    </div>
  );
}

export default function SignInViewPage() {
  const params = useSearchParams();
  const router = useRouter();
  const returnUrl = params.get('returnUrl');
  const { isAuthenticated } = useAuth();
  const form = useLoginForm(() => router.replace(safeReturnUrl(returnUrl)));

  useEffect(() => {
    if (isAuthenticated && !form.busy) router.replace(safeReturnUrl(returnUrl));
  }, [isAuthenticated, form.busy, returnUrl, router]);

  return (
    <AuthShell>
      <title>Giriş · FyBlue</title>
      <div className='flex flex-col space-y-2 text-center'>
        <h1 className='text-2xl font-semibold tracking-tight'>Giriş yap</h1>
        <p className='text-muted-foreground text-sm'>FyBlue hesabınızın kullanıcı adı ve şifresini girin.</p>
      </div>
      <form onSubmit={form.submit} className='grid w-full gap-4'>
        <div className='grid gap-2'>
          <Label htmlFor='username'>Kullanıcı adı</Label>
          <Input id='username' autoComplete='username' autoFocus value={form.username} onChange={(e) => form.setUsername(e.target.value)} />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='password'>Şifre</Label>
          <Input
            id='password'
            type='password'
            autoComplete='current-password'
            value={form.password}
            onChange={(e) => form.setPassword(e.target.value)}
          />
        </div>
        <div className='grid gap-2'>
          <Label>Arayüz şablonu</Label>
          <TemplatePicker />
        </div>
        <Notice kind='error'>{form.error}</Notice>
        <Button type='submit' disabled={form.busy} className='w-full'>
          {form.busy && <Spinner />}
          Giriş yap
        </Button>
      </form>
      <p className='text-muted-foreground px-8 text-center text-sm'>
        Hesabınız yok mu?{' '}
        <Link
          href={returnUrl ? `/signup/?returnUrl=${encodeURIComponent(returnUrl)}` : '/signup/'}
          className='hover:text-primary underline underline-offset-4'
        >
          Kayıt olun
        </Link>
      </p>
    </AuthShell>
  );
}
