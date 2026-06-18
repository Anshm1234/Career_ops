/** @type {import('next').NextConfig} */

// Strip trailing slash so we never produce a double slash in the rewrite.
const RAW_BACKEND = process.env.BACKEND_URL || "http://localhost:8000"
const BACKEND = RAW_BACKEND.replace(/\/+$/, "")

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND}/:path*`,
      },
    ]
  },
}

export default nextConfig
