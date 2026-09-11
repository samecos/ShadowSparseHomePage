import Link from 'next/link';
import { site } from '@/lib/site';
import { ArrowUpRight } from '@/components/icons';
import styles from './site-footer.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.inner} shell`}>
        <div className={styles.identity}>
          <strong>{site.name}</strong>
          <p>
            一个持续生长的个人主页。所有内容都保持开放、可迁移、可被 AI 打理。
          </p>
        </div>

        <div>
          <p className={styles.columnTitle}>Index</p>
          <div className={styles.links}>
            {site.nav.slice(1).map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className={styles.columnTitle}>Elsewhere</p>
          <div className={styles.links}>
            <a href={`mailto:${site.email}`}>{site.email}</a>
            <a href="https://github.com/" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="https://www.are.na/" target="_blank" rel="noreferrer">
              Are.na
            </a>
          </div>
        </div>

        <div className={styles.buttons}>
          <Link className="btn btn--small" href="/collection/hermes">
            HERMES
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
