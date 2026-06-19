/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le package partagé est en TS brut : Next doit le transpiler.
  transpilePackages: ["@cinco-wiki/shared"],
  images: {
    // Images servies depuis S3 (eu-west-3) — domaine ajusté au déploiement.
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
