'use client';

import { useEffect, useState } from 'react';
import { site } from '@/lib/site';
import styles from './intro-ritual.module.css';

type Phase = 'playing' | 'exiting' | 'done';

const POEM = ['争', '渡', '，', '争', '渡', '，', '惊', '起', '一', '滩', '鸥', '鹭'];
// 传统印章竖读：右列 易、安，左列 居、士
const SEAL = ['居', '易', '士', '安'];
// 一滩鸥鹭：远近大小、浓淡、起飞先后各不相同
const EGRETS = [
  { top: 48, width: 92, delay: 0.8, duration: 2.0, rise: -32, peak: 0.85 },
  { top: 56, width: 64, delay: 0.88, duration: 2.05, rise: -27, peak: 0.7 },
  { top: 63, width: 46, delay: 0.96, duration: 2.1, rise: -22, peak: 0.6 },
  { top: 68, width: 34, delay: 1.02, duration: 2.15, rise: -18, peak: 0.5 }
];

const PLAY_MS = 3100;
const EXIT_MS = 700;

function formatToday() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
}

export function IntroRitual() {
  const [phase, setPhase] = useState<Phase>('playing');
  const [today, setToday] = useState('');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('done');
      return;
    }
    document.body.style.overflow = 'hidden';
    setToday(formatToday());
    const playTimer = window.setTimeout(() => setPhase('exiting'), PLAY_MS);
    const skipByKey = () => setPhase('exiting');
    window.addEventListener('keydown', skipByKey);
    return () => {
      window.clearTimeout(playTimer);
      window.removeEventListener('keydown', skipByKey);
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (phase !== 'exiting') return;
    const exitTimer = window.setTimeout(() => {
      setPhase('done');
      document.body.style.overflow = '';
    }, EXIT_MS);
    return () => window.clearTimeout(exitTimer);
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      aria-label="跳过开场，进入首页"
      className={`${styles.overlay} ${phase === 'exiting' ? styles.exiting : ''}`}
      onClick={() => setPhase('exiting')}
      role="button"
      tabIndex={-1}
    >
      {EGRETS.map((egret, index) => (
        <svg
          aria-hidden="true"
          className={styles.egret}
          key={index}
          style={
            {
              top: `${egret.top}%`,
              width: egret.width,
              '--delay': `${egret.delay}s`,
              '--dur': `${egret.duration}s`,
              '--rise': `${egret.rise}vh`,
              '--peak': egret.peak
            } as React.CSSProperties
          }
          viewBox="0 0 96 32"
        >
          <path
            d="M4 24 Q20 6 36 20 Q48 30 60 16 Q72 4 92 12"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
      ))}

      <svg aria-hidden="true" className={styles.filterDef} focusable="false" height="0" width="0">
        <filter id="seal-rough">
          <feTurbulence baseFrequency="0.045" numOctaves="4" result="noise" type="fractalNoise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        </filter>
      </svg>

      <div className={styles.stage} aria-hidden="true">
        <div className={styles.seal}>
          {SEAL.map((char) => (
            <span className={styles.sealChar} key={char}>
              {char}
            </span>
          ))}
        </div>
        <p className={styles.poem}>
          {POEM.map((char, index) => (
            <span
              className={styles.char}
              key={`${char}-${index}`}
              style={{ animationDelay: `${0.9 + index * 0.075}s` }}
            >
              {char}
            </span>
          ))}
        </p>
      </div>

      <p className={styles.meta}>
        {today ? `${today} · ` : ''}
        {site.coordinates}
      </p>
      <span className={styles.skip}>跳过</span>
    </div>
  );
}
