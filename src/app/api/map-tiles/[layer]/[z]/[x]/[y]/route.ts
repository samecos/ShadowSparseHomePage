import type { NextRequest } from 'next/server';

type Context = {
  params: Promise<{ layer: string; z: string; x: string; y: string }>;
};

type RasterLayer = {
  mapId: string;
  format: 'jpg' | 'png';
};

function resolveLayer(layer: string): RasterLayer | null {
  if (layer === 'satellite') {
    return {
      mapId: process.env.MAPTILER_SATELLITE_MAP_ID ?? 'satellite-v4',
      format: 'jpg'
    };
  }

  if (layer === 'base') {
    return {
      mapId: process.env.MAPTILER_BASE_MAP_ID ?? 'base-v4',
      format: 'png'
    };
  }

  return null;
}

function parseCoordinate(raw: string) {
  if (/^\d+$/.test(raw) === false) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export async function GET(request: NextRequest, context: Context) {
  const { layer, z: rawZ, x: rawX, y: rawY } = await context.params;
  const rasterLayer = resolveLayer(layer);

  if (rasterLayer === null) {
    return new Response('Unknown map layer.', { status: 404 });
  }

  const z = parseCoordinate(rawZ);
  if (z === null || z > 24) {
    return new Response('Invalid tile z coordinate.', { status: 400 });
  }

  const tileCount = 2 ** z;
  const x = parseCoordinate(rawX);
  const y = parseCoordinate(rawY);
  if (x === null || y === null || x >= tileCount || y >= tileCount) {
    return new Response('Invalid tile x/y coordinate.', { status: 400 });
  }

  const key = process.env.MAPTILER_KEY ?? '';
  if (key.length === 0) {
    console.error('[map-tiles] MAPTILER_KEY is not configured.');
    return new Response('Map provider is not configured.', { status: 503 });
  }

  const upstreamUrl = new URL(
    `https://api.maptiler.com/maps/${rasterLayer.mapId}/${z}/${x}/${y}.${rasterLayer.format}`
  );
  upstreamUrl.searchParams.set('key', key);

  const upstreamHeaders = new Headers({
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
  });

  // MapTiler's "Allowed User-Agent header" is checked against this server-side
  // request. Browsers intentionally forbid JavaScript from setting User-Agent.
  const userAgent = process.env.MAPTILER_USER_AGENT;
  if (userAgent) upstreamHeaders.set('User-Agent', userAgent);

  // If the key is also protected by "Allowed HTTP origins", forward the page's
  // Referer (or fall back to the configured public site URL).
  const referer = request.headers.get('referer') ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (referer) upstreamHeaders.set('Referer', referer);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: upstreamHeaders,
      cache: 'no-store'
    });
  } catch (error) {
    console.error('[map-tiles] Failed to reach MapTiler.', error);
    return new Response('Map provider is unreachable.', { status: 502 });
  }

  if (upstream.ok === false) {
    console.error(
      `[map-tiles] MapTiler responded ${upstream.status} for ${rasterLayer.mapId}/${z}/${x}/${y}.`
    );
    return new Response('Map tile request was rejected.', { status: upstream.status });
  }

  const headers = new Headers({
    'Content-Type':
      upstream.headers.get('content-type') ??
      (rasterLayer.format === 'jpg' ? 'image/jpeg' : 'image/png'),
    'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800'
  });
  const etag = upstream.headers.get('etag');
  if (etag) headers.set('ETag', etag);

  return new Response(upstream.body, { status: 200, headers });
}
