/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion', '@capacitor/core', '@capacitor/app'],
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
          {
            key: 'Content-Security-Policy',
            value: "img-src 'self' blob: data: https://*.supabase.co https://*.mapbox.com https://*.googleusercontent.com;",
          },
        ],
      },
    ]
  },
}

export default nextConfig
