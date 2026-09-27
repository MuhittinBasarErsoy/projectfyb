'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();

  // Diğer şablonlardan gelen servis detay adresi (/epias/endpoints/<anahtar>) bu şablonda
  // statik yayın nedeniyle /epias/endpoints/detail/?key=<anahtar> biçimindedir.
  useEffect(() => {
    const m = /\/starter\/epias\/endpoints\/([^/]+)\/?$/.exec(window.location.pathname);
    if (m && m[1] !== 'detail') router.replace(`/epias/endpoints/detail/?key=${m[1]}`);
  }, [router]);

  return (
    <div className='absolute top-1/2 left-1/2 mb-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-center'>
      <span className='from-foreground bg-linear-to-b to-transparent bg-clip-text text-[10rem] leading-none font-extrabold text-transparent'>
        404
      </span>
      <h2 className='font-heading my-2 text-2xl font-bold'>Sayfa bulunamadı</h2>
      <p>Aradığınız sayfa yok ya da taşınmış.</p>
      <div className='mt-8 flex justify-center gap-2'>
        <Button onClick={() => router.back()} variant='default' size='lg'>
          Geri dön
        </Button>
        <Button onClick={() => router.push('/')} variant='ghost' size='lg'>
          Ana sayfa
        </Button>
      </div>
    </div>
  );
}
