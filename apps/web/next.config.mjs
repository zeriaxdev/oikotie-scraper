/** @type {import('next').NextConfig} */
const nextConfig = {
  // Default the DB path to the repo-root oikotie.db (relative to apps/web),
  // unless DB_PATH is already set in the environment.
  env: { DB_PATH: process.env.DB_PATH ?? "../../oikotie.db" },
  // Allow importing the scraper/db/analysis modules that live outside apps/web.
  experimental: { externalDir: true },
  // bun:sqlite is a Bun builtin — keep it external so it resolves at runtime
  // (the server must run under Bun: `bun --bun next dev`).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({ "bun:sqlite": "commonjs bun:sqlite" });
    }
    return config;
  },
};

export default nextConfig;
