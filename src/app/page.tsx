import Link from 'next/link';
import { ArrowUpRight } from '@/components/icons';
import { PageBackdrop } from '@/components/site/page-backdrop';
import { formatDate } from '@/lib/format';
import { site } from '@/lib/site';
import { readCollection } from '@/lib/storage';
import type { Collectible, MapStory, Photo, Post, Work } from '@/lib/types';
import { visiblePhotos } from '@/lib/photos';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

const fallbackCover = '/cover-placeholder.png';

function byNewest<T>(items: T[], pick: (item: T) => string) {
  return [...items].sort((a, b) => new Date(pick(b)).getTime() - new Date(pick(a)).getTime());
}

function firstImage(images?: string[]) {
  return images?.find((image) => image.trim().length > 0);
}

export default async function HomePage() {
  const [posts, stories, works, collectibles, photos] = await Promise.all([
    readCollection<Post>('posts'),
    readCollection<MapStory>('map-stories'),
    readCollection<Work>('works'),
    readCollection<Collectible>('collectibles'),
    readCollection<Photo>('photos')
  ]);

  const publicPhotos = visiblePhotos(photos, false);

  const publicPosts = byNewest(
    posts.filter((post) => post.visibility === 'public'),
    (post) => post.createdAt
  );
  const publicStories = byNewest(stories, (story) => story.date).slice(0, 1);
  const publicCollections = byNewest(
    collectibles.filter((item) => item.status !== 'archived'),
    (item) => item.createdAt
  );
  const currentYear = new Date().getFullYear();
  const latestPost = publicPosts.find((post) => firstImage(post.images)) ?? publicPosts[0];
  const latestStory = publicStories[0];
  const latestCollection =
    publicCollections.find((item) => item.image?.trim().length) ?? publicCollections[0];
  const latestPostImage = firstImage(latestPost?.images);
  const latestCollectionImage = latestCollection?.image?.trim();

  const modules = [
    {
      href: '/says',
      index: '01',
      title: '日常说说',
      description: '轻博客式的碎片记录。心情、地点、照片，以及那些不值得单独成文但想留下来的瞬间。',
      count: `${publicPosts.length} 则`
    },
    {
      href: '/photos',
      index: '02',
      title: '照片',
      description: '按拍摄时间排列的底片库。放大、收藏、整理，把每一次快门留在它发生的那一天。',
      count: `${publicPhotos.length} 张`
    },
    {
      href: '/map',
      index: '03',
      title: '地图故事',
      description: '把照片放回发生的地方。可以拖动照片的位置，也可以为一段记忆写下文字标注。',
      count: `${stories.length} 段`
    },
    {
      href: '/work',
      index: '04',
      title: '工作展示',
      description: '做过的项目、承担的角色和具体成果。每一个都可以作为子页面单独打开。',
      count: `${works.length} 个项目`
    },
    {
      href: '/collection',
      index: '05',
      title: '有趣的搜集',
      description: '由 HERMES 持续整理的灵感仓库。链接、图像、句子和声音，都会先落入收件箱，再被慢慢归位。',
      count: `${collectibles.filter((item) => item.status !== 'archived').length} 件`
    }
  ];

  return (
    <main className="main">
      <div className="shell">
        <section className={`${styles.hero} reveal`}>
          <PageBackdrop src="/photos/photo-01.png" />
          <div className={styles.heroMain}>
            <p className={`eyebrow ${styles.heroEyebrow}`}>Personal index · {currentYear}</p>
            <h1 className={`display ${styles.heroTitle}`}>
              把日常整理成
              <br />
              <em>一处安静的地方。</em>
            </h1>
          </div>

          <div className={styles.heroIntro}>
            <p className={styles.heroLead}>{site.intro}</p>
            <div className={styles.heroMeta}>
              <span>{site.location}</span>
              <span>{site.coordinates}</span>
              <span>五件事，长期更新</span>
            </div>
          </div>

          <div className={styles.heroFacts} aria-label="站点信息">
            <dl className={styles.fact}>
              <dt>Now</dt>
              <dd>在做一个清爽的个人主页</dd>
            </dl>
            <dl className={styles.fact}>
              <dt>Principle</dt>
              <dd>少即是多，但不冷漠</dd>
            </dl>
            <dl className={styles.fact}>
              <dt>Agent</dt>
              <dd>{site.hermes.name} 负责搜集</dd>
            </dl>
          </div>
        </section>

        <section className={`${styles.section} reveal reveal-delay-1`}>
          <div className="section-head">
            <h2 className="section-head__title">目录</h2>
            <span className="section-head__meta">05 ENTRIES</span>
          </div>
          <div className={styles.indexRows}>
            {modules.map((item) => (
              <Link className={styles.indexRow} key={item.href} href={item.href}>
                <span className={styles.indexNum}>{item.index}</span>
                <div>
                  <h3 className={styles.indexTitle}>{item.title}</h3>
                  <p className={styles.indexDesc}>{item.description}</p>
                </div>
                <span className={styles.indexMeta}>{item.count}</span>
                <span className={styles.indexArrow}>
                  <ArrowUpRight size={20} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className={`${styles.section} reveal reveal-delay-2`}>
          <div className="section-head">
            <h2 className="section-head__title">最近</h2>
            <span className="section-head__meta">UPDATED RECENTLY</span>
          </div>
          <div className={styles.recentGrid} style={{ marginTop: 28 }}>
            {latestStory ? (
              <Link className={styles.recentCard} href="/map">
                <span className={styles.recentLabel}>地图故事</span>
                <span className={styles.recentMedia}>
                  <img
                    className={styles.recentImage}
                    src={latestStory.photos[0]?.url ?? fallbackCover}
                    alt={
                      latestStory.photos[0]
                        ? latestStory.photos[0].caption || latestStory.title
                        : ''
                    }
                  />
                </span>
                <h3 className={styles.recentTitle}>{latestStory.title}</h3>
                <p className={styles.recentText}>{latestStory.note}</p>
                <span className={styles.recentTime}>
                  {latestStory.locationName} · {formatDate(latestStory.date)}
                </span>
              </Link>
            ) : null}

            {latestPost ? (
              <Link className={styles.recentCard} href="/says">
                <span className={styles.recentLabel}>日常说说</span>
                <span className={styles.recentMedia}>
                  <img
                    className={styles.recentImage}
                    src={latestPostImage ?? fallbackCover}
                    alt={latestPostImage ? '最近一则说说的配图' : ''}
                  />
                </span>
                <h3 className={styles.recentTitle}>{latestPost.mood || '最近'}</h3>
                <p className={styles.recentText}>{latestPost.content}</p>
                <span className={styles.recentTime}>{formatDate(latestPost.createdAt)}</span>
              </Link>
            ) : null}

            {latestCollection ? (
              <Link className={styles.recentCard} href="/collection">
                <span className={styles.recentLabel}>有趣的搜集</span>
                <span className={styles.recentMedia}>
                  <img
                    className={styles.recentImage}
                    src={latestCollectionImage ?? fallbackCover}
                    alt={latestCollectionImage ? latestCollection.title : ''}
                  />
                </span>
                <h3 className={styles.recentTitle}>{latestCollection.title}</h3>
                <p className={styles.recentText}>
                  {latestCollection.agentSummary || latestCollection.description}
                </p>
                <span className={styles.recentTime}>
                  {latestCollection.collectedBy === 'hermes' ? 'HERMES 收录' : '我收录'} ·{' '}
                  {formatDate(latestCollection.createdAt)}
                </span>
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
