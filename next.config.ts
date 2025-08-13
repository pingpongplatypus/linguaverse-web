// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export', // Keep this line as we set it up earlier
  
  // Add this webpack configuration to ignore functions directories
  webpack: (config, { isServer }) => {
    // Exclude the functions directories from Webpack compilation
    // This ensures Next.js doesn't try to bundle backend code
    config.externals = config.externals || [];
    config.externals.push(
      // Regex to match anything starting with 'functions/' or 'functions-web/'
      /^functions(\/|$)/,
      /^functions-web(\/|$)/,
    );

    return config;
  },
};

export default nextConfig;
