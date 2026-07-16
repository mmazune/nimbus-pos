/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  modularizeImports: {
    "@phosphor-icons/react": {
      transform: "@phosphor-icons/react/dist/ssr/{{member}}",
      skipDefaultConversion: true,
    },
  },
};

export default nextConfig;
