import type { Metadata } from 'next';
import { DM_Sans, Noto_Nastaliq_Urdu } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { directionOf, type AppLocale } from '@edventure/i18n';
import { Providers } from './providers';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const urdu = Noto_Nastaliq_Urdu({ subsets: ['arabic'], weight: ['400', '600', '700'], variable: '--font-urdu-face', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Edventure', template: '%s · Edventure' },
  description: 'School management for administrators',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const locale: AppLocale = store.get('edv_locale')?.value === 'ur' ? 'ur' : 'en';
  return (
    <html lang={locale} dir={directionOf(locale)} className={`${dmSans.variable} ${urdu.variable}`}>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
