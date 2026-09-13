// 聚类纯函数自测:node --experimental-strip-types scripts/check-people.mjs
// Node ESM 不做扩展名猜测,people.ts 按 brief 原文从 './storage' 引入,
// 这里注册一个解析钩子补上 '.ts' 后缀,使库代码保持逐字不变。
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error && error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('./')) {
      return nextResolve(specifier + '.ts', context);
    }
    throw error;
  }
}`)
);

const { assignFaces, descriptorDistance } = await import('../src/lib/people.ts');

const vec = (index, value) => {
  const v = new Array(128).fill(0);
  v[index] = value;
  return v;
};
const face = (id, descriptor) => ({
  id,
  photoId: 'photo_x',
  box: { x: 0, y: 0, w: 0.1, h: 0.1 },
  descriptor,
  thumbUrl: '/uploads/x.jpg',
  personId: null,
  createdAt: 'now'
});

const checks = [];
// 相近人脸(a1/a2 距离 0.1)应进同一聚类;远人脸(b1 距离约 1.4)应新建聚类
const a1 = face('f1', vec(0, 1));
const a2 = face('f2', vec(0, 1.1));
const b1 = face('f3', vec(1, 1));
const first = assignFaces([], [], [a1, a2], new Set(), 't0');
checks.push(['两张相近人脸同聚类', first.assignments.get('f1') === first.assignments.get('f2')]);
const second = assignFaces(first.people, [a1, a2], [b1], new Set(), 't1');
checks.push(['远人脸新建聚类', second.assignments.get('f3') !== second.assignments.get('f2')]);
checks.push(['共两个聚类', second.people.length === 2]);
// 删除某照片的全部人脸后,单脸聚类被清理
const third = assignFaces(second.people, [b1], [], new Set(['f1', 'f2']), 't2');
checks.push(['空聚类被清理', third.people.length === 1]);
checks.push(['欧氏距离', Math.abs(descriptorDistance(vec(0, 3), vec(0, 0)) - 3) < 1e-9]);

let failed = 0;
checks.forEach(([label, pass]) => {
  if (!pass) failed += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`);
});
if (failed > 0) process.exit(1);
console.log('全部通过');
