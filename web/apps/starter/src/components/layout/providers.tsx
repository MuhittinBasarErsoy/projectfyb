'use client';
import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ActiveThemeProvider>{children}</ActiveThemeProvider>;
}
