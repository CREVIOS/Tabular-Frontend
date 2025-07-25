import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  
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

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: `
              frame-src 'self' *.supabase.co *.amazonaws.com *.storage.googleapis.com https:;
              frame-ancestors 'self';
            `.replace(/\s+/g, ' ').trim()
          }
        ]
      }
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
  
  // Enhanced experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@tabler/icons-react', '@radix-ui/react-avatar', '@radix-ui/react-dialog'],
    webpackBuildWorker: true,
    parallelServerCompiles: true,
    parallelServerBuildTraces: true,
  },
  
  // Image optimization - enable for better performance
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year
    domains: ['makebell.com', 'supabase.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      }
    ]
  },

  // Webpack optimizations
  webpack: (config, { isServer, webpack }) => {
    // Optimize for production
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Add bundle analyzer in production build
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
    }

    return config;
  },

  // Static page generation optimization
  trailingSlash: false,
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
};

export default nextConfig;
