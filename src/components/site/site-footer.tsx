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
            <a className={styles.external} href={`mailto:${site.email}`}>
              {site.email}
            </a>
            <a className={styles.external} href="https://github.com/" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className={styles.external} href="https://www.are.na/" target="_blank" rel="noreferrer">
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

      <div className={`${styles.meta} shell`}>
        <span>© {new Date().getFullYear()} {site.name}</span>
        <span className={styles.metaSep} aria-hidden="true">
          ·
        </span>
        <span>{site.location}</span>
        <span className={styles.metaSep} aria-hidden="true">
          ·
        </span>
        <Link className={styles.metaLink} href="/collection/hermes">
          由 {site.hermes.name} 打理
        </Link>
      </div>
    </footer>
  );
}
