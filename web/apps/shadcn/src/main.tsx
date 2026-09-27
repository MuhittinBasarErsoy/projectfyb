import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/css/globals.css';
import App from './App.tsx';
import Spinner from './views/spinner/Spinner.tsx';

import { ThemeProvider } from './context/shadcntheme/ThemeContext.tsx';

// Tema tercihi üç şablonda ortaktır ("theme" anahtarı).
createRoot(document.getElementById('root')!).render(
  <ThemeProvider defaultTheme="system" storageKey="theme">
    <Suspense fallback={<Spinner />}>
      <App />
    </Suspense>
  </ThemeProvider>,
);
