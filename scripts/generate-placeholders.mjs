import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.cwd(), 'public', 'photos');
mkdirSync(outDir, { recursive: true });

const palettes = [
  ['#EEF2F5', '#CBD8E1', '#8299A8', '#F8FAFB'],
  ['#E8EDF0', '#B9C9D2', '#6F8798', '#F5F8F9'],
  ['#F0F2F3', '#C4D0D6', '#7C929F', '#FBFCFC'],
  ['#E6EAEE', '#AFC2CE', '#5F788A', '#F4F7F8'],
  ['#EDEFF0', '#C9D3D6', '#8197A1', '#F9FAFA'],
  ['#E3E9EC', '#A9BEC8', '#60798A', '#F2F6F7']
];

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function svgFor(index, variant = 'photo') {
  const random = mulberry32(index * 7919 + variant.length * 37);
  const [light, mid, deep, paper] = palettes[index % palettes.length];
  const width = 1600;
  const height = 1100;
  const horizon = 560 + Math.round(random() * 180);
  const moonX = 260 + Math.round(random() * 980);
  const moonY = 170 + Math.round(random() * 220);
  const moonR = 50 + Math.round(random() * 90);
  const hillA = 140 + Math.round(random() * 160);
  const hillB = 220 + Math.round(random() * 180);
  const lineOpacity = 0.18 + random() * 0.16;
  const grainId = `grain-${index}-${variant}`;
  const gradientId = `sky-${index}-${variant}`;
  const deepId = `deep-${index}-${variant}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="抽象冷色风景">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="${paper}"/>
      <stop offset="58%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${mid}"/>
    </linearGradient>
    <linearGradient id="${deepId}" x1="0" y1="0" x2="1" y2="0.4">
      <stop offset="0%" stop-color="${mid}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${deep}" stop-opacity="0.82"/>
    </linearGradient>
    <filter id="${grainId}">
      <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.055"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#${gradientId})"/>
  <circle cx="${moonX}" cy="${moonY}" r="${moonR}" fill="${paper}" fill-opacity="0.66"/>
  <circle cx="${moonX}" cy="${moonY}" r="${moonR + 46}" fill="${paper}" fill-opacity="0.12"/>
  <path d="M0 ${horizon} C 260 ${horizon - hillA} 420 ${horizon + 50} 700 ${horizon - 26} C 980 ${horizon - hillB} 1200 ${horizon + 80} 1600 ${horizon - hillA / 2} L1600 ${height} L0 ${height} Z" fill="url(#${deepId})" fill-opacity="0.56"/>
  <path d="M0 ${horizon + 128} C 320 ${horizon + 40} 520 ${horizon + 190} 840 ${horizon + 82} C 1100 ${horizon + 4} 1320 ${horizon + 150} 1600 ${horizon + 74} L1600 ${height} L0 ${height} Z" fill="${deep}" fill-opacity="0.42"/>
  <g stroke="${paper}" stroke-opacity="${lineOpacity}" stroke-width="1.5" fill="none">
    <path d="M-20 ${horizon - 210} C 320 ${horizon - 300} 680 ${horizon - 120} 1040 ${horizon - 230} C 1320 ${horizon - 320} 1470 ${horizon - 220} 1620 ${horizon - 270}"/>
    <path d="M-20 ${horizon - 170} C 280 ${horizon - 250} 600 ${horizon - 90} 940 ${horizon - 180} C 1240 ${horizon - 260} 1440 ${horizon - 160} 1620 ${horizon - 210}"/>
  </g>
  <rect width="${width}" height="${height}" filter="url(#${grainId})" opacity="0.8"/>
</svg>
`;
}

const photos = Array.from({ length: 12 }, (_, index) => `photo-${String(index + 1).padStart(2, '0')}.svg`);
const works = Array.from({ length: 4 }, (_, index) => `work-${String(index + 1).padStart(2, '0')}.svg`);

photos.forEach((file, index) => writeFileSync(path.join(outDir, file), svgFor(index + 1), 'utf8'));
works.forEach((file, index) => writeFileSync(path.join(outDir, file), svgFor(index + 41, 'work'), 'utf8'));

console.log(`generated ${photos.length + works.length} placeholder images in public/photos`);
