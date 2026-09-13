'use client';

import type { Photo } from './types';

type FaceApi = typeof import('@vladmandic/face-api');

const MODEL_URL = '/models/face-api';
const SCAN_STORAGE_KEY = 'photos-face-scan-v1';
const THUMB_SIZE = 160;

let apiPromise: Promise<FaceApi> | null = null;

/** 单例加载 face-api 与三个模型(检测/关键点/特征)。 */
export function loadFaceApi(): Promise<FaceApi> {
  apiPromise ??= (async () => {
    const faceapi = await import('@vladmandic/face-api');
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    return faceapi;
  })().catch((cause) => {
    apiPromise = null;
    throw cause;
  });
  return apiPromise;
}

export interface DetectedFace {
  box: { x: number; y: number; w: number; h: number }; // 归一化
  descriptor: number[];
  thumb: Blob;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`图片加载失败:${url}`));
    image.src = url;
  });
}

function cropFace(
  image: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const size = Math.max(box.width, box.height) * 1.7;
  const sx = Math.max(0, box.x + box.width / 2 - size / 2);
  const sy = Math.max(0, box.y + box.height / 2 - size / 2);
  const side = Math.max(1, Math.min(size, image.naturalWidth - sx, image.naturalHeight - sy));
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('无法创建画布。'));
  context.drawImage(image, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('头像裁剪失败。'))),
      'image/jpeg',
      0.85
    );
  });
}

/** 对单张照片做人脸检测 + 特征提取 + 头像裁剪。 */
export async function detectFacesInPhoto(url: string): Promise<DetectedFace[]> {
  const faceapi = await loadFaceApi();
  const image = await loadImage(url);
  const results = await faceapi
    .detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  const { naturalWidth: width, naturalHeight: height } = image;
  const faces: DetectedFace[] = [];
  for (const result of results) {
    const box = result.detection.box;
    faces.push({
      box: { x: box.x / width, y: box.y / height, w: box.width / width, h: box.height / height },
      descriptor: Array.from(result.descriptor),
      thumb: await cropFace(image, box)
    });
  }
  return faces;
}

async function uploadThumb(blob: Blob) {
  const body = new FormData();
  body.append('file', new File([blob], `face-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  const response = await fetch('/api/upload', { method: 'POST', body });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: { url?: string };
    error?: string;
  };
  if (response.ok === false || !payload.data?.url) {
    throw new Error(payload.error ?? '头像上传失败。');
  }
  return payload.data.url;
}

function readScanMarkers(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(SCAN_STORAGE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function markScanned(photoId: string, updatedAt: string) {
  const markers = readScanMarkers();
  markers[photoId] = updatedAt;
  try {
    window.localStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(markers));
  } catch {
    // localStorage 不可用时跳过扫描标记
  }
}

/** 还没扫描过(或扫描后照片有更新)的照片。 */
export function pendingScans(photos: Photo[]): Photo[] {
  const markers = readScanMarkers();
  return photos.filter((photo) => markers[photo.id] !== photo.updatedAt);
}

/** 扫描单张照片并把结果提交到服务端聚类。返回检测到的人脸数。 */
export async function scanPhoto(photo: Photo): Promise<number> {
  const detected = await detectFacesInPhoto(photo.url);
  const faces = [];
  for (const item of detected) {
    const thumbUrl = await uploadThumb(item.thumb);
    faces.push({ box: item.box, descriptor: item.descriptor, thumbUrl });
  }
  const response = await fetch(`/api/photos/${photo.id}/faces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faces })
  });
  if (response.ok === false) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? '人脸结果保存失败。');
  }
  markScanned(photo.id, photo.updatedAt);
  return faces.length;
}
