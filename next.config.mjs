import { networkInterfaces } from 'node:os';

// The dev server rejects script requests whose Origin is not localhost, which
// breaks dynamic imports when the site is opened from a phone via the LAN IP.
// Allow this machine's LAN addresses so mobile testing works.
const lanOrigins = Object.values(networkInterfaces())
  .flat()
  .filter((entry) => entry?.family === 'IPv4' && entry.internal === false)
  .map((entry) => entry.address);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: lanOrigins,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }]
  }
};

export default nextConfig;
