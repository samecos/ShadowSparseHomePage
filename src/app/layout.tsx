import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: `${site.name} · 个人主页`,
    template: `%s · ${site.name}`
  },
  description: site.intro,
  icons: {
    icon: { url: site.avatar, type: 'image/jpeg' },
    shortcut: { url: site.avatar, type: 'image/jpeg' },
    apple: { url: site.avatar, type: 'image/jpeg' }
  },
  openGraph: {
    title: `${site.name} · 个人主页`,
    description: site.tagline,
    type: 'website',
    locale: 'zh_CN',
    images: [
      {
        url: site.avatar,
        width: 828,
        height: 828,
        alt: `${site.name} 头像`
      }
    ]
  }
};

export const viewport: Viewport = {
  themeColor: '#f6f7f8',
  colorScheme: 'light'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
