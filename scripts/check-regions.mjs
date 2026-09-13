// 已知坐标断言:node --experimental-strip-types scripts/check-regions.mjs
import { lookupRegion } from '../src/lib/geo/regions.ts';

const cases = [
  { lng: 120.1392, lat: 30.2666, city: '杭州市', label: '杭州北山街' },
  { lng: 116.4074, lat: 39.9042, city: '北京市', label: '北京城区' },
  { lng: 121.4737, lat: 31.2304, city: '上海市', label: '上海城区' },
  { lng: 109.5083, lat: 18.2479, city: '三亚市', label: '三亚' },
  { lng: 87.6168, lat: 43.8256, city: '乌鲁木齐市', label: '乌鲁木齐' },
  { lng: 2.3522, lat: 48.8566, city: null, label: '巴黎(境外应为 null)' }
];

let failed = 0;
for (const item of cases) {
  const region = await lookupRegion(item.lng, item.lat);
  const got = region ? region.city : null;
  const pass = got === item.city;
  if (!pass) failed += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${item.label}: 期望 ${item.city},实际 ${got}`);
}
if (failed > 0) process.exit(1);
console.log('全部通过');
