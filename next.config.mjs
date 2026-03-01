/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'geolocation=*',
          },
        ],
      },
    ]
  },
}

export default nextConfig
