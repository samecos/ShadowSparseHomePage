'use client';

import { useEffect, useState } from 'react';

type AuthPayload = { data?: { admin?: boolean } };

/**
 * 读取当前会话，默认始终按游客处理。
 * 只有 /api/auth 明确返回管理员身份后，编辑界面才会出现。
 */
export function useAdminSession() {
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    fetch('/api/auth', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: AuthPayload | null) => {
        if (active) setAdmin(Boolean(payload?.data?.admin));
      })
      .catch(() => {
        if (active) setAdmin(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { admin };
}
