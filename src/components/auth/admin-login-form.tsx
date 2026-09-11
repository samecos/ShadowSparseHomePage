'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import styles from './admin-login.module.css';

export function AdminLoginForm({ entryKey }: { entryKey: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, entry: entryKey })
      });
      const payload = (await response.json()) as { error?: string };

      if (response.ok === false) {
        setError(payload.error ?? '登录失败。');
        setSubmitting(false);
        return;
      }

      router.push('/says');
      router.refresh();
    } catch {
      setError('暂时无法连接服务器，请稍后再试。');
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.panel} reveal`}>
        <p className="eyebrow">Private access</p>
        <h1>站长后台</h1>
        <p>输入管理口令。登录后可以发布日常说说，并编辑地图故事。</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">口令</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入管理口令"
              autoComplete="current-password"
              autoFocus
              required
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className="btn btn--primary" type="submit" disabled={submitting}>
            {submitting ? '验证中…' : '进入'}
          </button>
        </form>

        <div className={styles.footer}>
          <Link href="/">返回首页</Link>
          <span>仅站长本人使用</span>
        </div>
      </div>
    </div>
  );
}
