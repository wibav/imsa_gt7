/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
    domains: ['firebasestorage.googleapis.com', 'via.placeholder.com', 'ws-eu.amazon-adsystem.com']
  },
  distDir: 'out',
  allowedDevOrigins: ['192.168.1.200']
}

export default nextConfig