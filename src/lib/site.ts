const mapAttribution =
  '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';

export const mapLayers = [
  {
    id: 'satellite',
    label: '卫星影像',
    tileUrl: '/api/map-tiles/satellite/{z}/{x}/{y}',
    attribution: mapAttribution
  },
  {
    id: 'base',
    label: 'Base 地图',
    tileUrl: '/api/map-tiles/base/{z}/{x}/{y}',
    attribution: mapAttribution
  }
] as const;

export type MapLayerId = (typeof mapLayers)[number]['id'];

const defaultMapLayer: MapLayerId =
  process.env.NEXT_PUBLIC_MAP_DEFAULT_LAYER === 'base' ? 'base' : 'satellite';

export const site = {
  name: '疏影渡',
  avatar: '/avatar.jpg',
  role: '设计、代码与日常观察',
  tagline: '把日常整理成一处安静的地方。',
  intro:
    '这里放我的日常说说、地图上的记忆、做过的工作，以及由 HERMES 打理的趣味收藏。不追求热闹，只希望每一次打开都足够安静、清楚。',
  location: 'Hangzhou, China',
  coordinates: '30.25° N, 120.14° E',
  email: 'hello@example.com',
  nav: [
    { href: '/', label: '首页', index: '00' },
    { href: '/says', label: '日常', index: '01' },
    { href: '/photos', label: '照片', index: '02' },
    { href: '/map', label: '地图', index: '03' },
    { href: '/work', label: '工作', index: '04' },
    { href: '/collection', label: '搜集', index: '05' }
  ],
  map: {
    center: [30.2501, 120.1402] as [number, number],
    zoom: 12,
    minZoom: 3,
    maxZoom: 18,
    defaultLayer: defaultMapLayer,
    layers: mapLayers
  },
  hermes: {
    name: 'HERMES',
    role: '个人收藏整理 Agent'
  }
};

export type SiteNavItem = (typeof site.nav)[number];
