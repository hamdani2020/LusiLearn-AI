/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@lusilearn/shared-types", "@lusilearn/ui"],
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3001',
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8001',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
}

module.exports = nextConfig