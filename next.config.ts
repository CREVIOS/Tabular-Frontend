import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  
  // Only use rewrites in development or when not using nginx
  async rewrites() {
    // Skip rewrites if using nginx proxy (production with nginx profile)
    if (process.env.USE_NGINX_PROXY === 'true') {
      return [];
    }
    
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'https://app2.makebell.com:8443'}/api/:path*`,
      },
    ];
  },
  
  // Environment variables
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'https://app2.makebell.com:8443',
    USE_NGINX_PROXY: process.env.USE_NGINX_PROXY || 'false',
  },
  
  // Public runtime config for client-side
  publicRuntimeConfig: {
    API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'https://app2.makebell.com:8443',
  },
  
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@tabler/icons-react'],
  },
  
  // Image optimization
  images: {
    unoptimized: true, // For Docker deployment
  },
};

export default nextConfig;
