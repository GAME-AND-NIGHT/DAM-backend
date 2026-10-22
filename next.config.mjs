/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    '/api/**/*': ['./data/**/*'],
  },
  async rewrites() {
    return [
      {
        source: '/painting/image/:id',
        destination: '/api/painting/image/:id',
      },
      {
        source: '/painting/info/:id',
        destination: '/api/painting/info/:id',
      },
      {
        source: '/painting/list',
        destination: '/api/painting/list',
      },
      {
        source: '/model/file/:id',
        destination: '/api/model/file/:id',
      },
      {
        source: '/model/info/:id',
        destination: '/api/model/info/:id',
      },
      {
        source: '/model/list',
        destination: '/api/model/list',
      },
      {
        source: '/video/file/:id',
        destination: '/api/video/file/:id',
      },
      {
        source: '/video/info/:id',
        destination: '/api/video/info/:id',
      },
      {
        source: '/video/list',
        destination: '/api/video/list',
      },
      {
        source: '/audio/:path*',
        destination: '/api/audio/file/:path*',
      },
      {
        source: '/quest/data',
        destination: '/api/quest/data',
      },
      {
        source: '/quest_data.json',
        destination: '/api/quest/data',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, HEAD, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: '*',
          },
          {
            key: 'Access-Control-Expose-Headers',
            value: 'X-Encrypted, X-Encryption-Algorithm, X-Encryption-IV, X-Original-Content-Type, X-Chunk-Size, X-Total-Chunks, X-Total-Size, Content-Range, Accept-Ranges',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
