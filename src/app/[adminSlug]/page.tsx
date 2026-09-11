import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminLoginForm } from '@/components/auth/admin-login-form';
import { verifyAdminSlug } from '@/lib/auth';

type PageProps = {
  params: Promise<{ adminSlug: string }>;
};

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '站长入口',
  robots: { index: false, follow: false }
};

export default async function PrivateLoginPage({ params }: PageProps) {
  const { adminSlug } = await params;

  // 未配置入口，或访问路径与配置不一致时，一律 404，
  // 不给访客留下“这里存在后台”的入口提示。
  if (verifyAdminSlug(adminSlug) === false) notFound();

  return (
    <main className="main main--flush" style={{ display: 'grid', alignItems: 'center' }}>
      <AdminLoginForm entryKey={adminSlug} />
    </main>
  );
}
