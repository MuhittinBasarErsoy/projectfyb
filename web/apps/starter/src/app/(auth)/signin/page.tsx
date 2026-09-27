import SignInViewPage from '@/features/auth/components/sign-in-view';
import { Suspense } from 'react';

// useSearchParams (dönüş adresi) statik yayında Suspense sınırı ister.
export default function Page() {
  return (
    <Suspense>
      <SignInViewPage />
    </Suspense>
  );
}
