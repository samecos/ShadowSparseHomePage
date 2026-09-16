'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { site } from '@/lib/site';
import styles from './site-header.module.css';

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label={`${site.name} 首页`}>
          <img className={styles.avatar} src={site.avatar} alt="" width={34} height={34} />
          <span className={styles.brandText}>
            <strong>{site.name}</strong>
            <small>{site.role}</small>
          </span>
        </Link>

        <nav className={`${styles.nav} hide-scrollbar`} aria-label="主导航">
          {site.nav.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
                href={item.href}
              >
                <sup>{item.index}</sup>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link className={styles.agent} href="/collection/hermes">
          <span>HERMES</span>
          <span className={styles.agentArrow} aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </header>
  );
}
