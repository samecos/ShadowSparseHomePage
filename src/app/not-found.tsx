import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="main">
      <div className="shell">
        <p className="eyebrow">404</p>
        <h1 className="page-title">这里什么都没有。</h1>
        <p className="page-intro">可能它被风吹走了，也可能只是还没有被写下来。</p>
        <p style={{ marginTop: 28 }}>
          <Link className="btn" href="/">
            回到首页
          </Link>
        </p>
      </div>
    </main>
  );
}
