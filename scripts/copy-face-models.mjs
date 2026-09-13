// 把 face-api 模型从 npm 包拷贝到 public,供浏览器加载。用法:npm run setup:faces
import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const PREFIXES = ['ssd_mobilenetv1', 'face_landmark_68', 'face_recognition'];
const source = path.join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'model');
const target = path.join(process.cwd(), 'public', 'models', 'face-api');

await mkdir(target, { recursive: true });
const files = (await readdir(source)).filter((name) =>
  PREFIXES.some((prefix) => name.startsWith(prefix))
);
if (files.length === 0) {
  console.error(`在 ${source} 没有找到模型文件,确认 @vladmandic/face-api 已安装。`);
  process.exit(1);
}
for (const file of files) {
  await cp(path.join(source, file), path.join(target, file));
}
console.log(`拷贝 ${files.length} 个模型文件 → ${path.relative(process.cwd(), target)}/`);
