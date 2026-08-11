
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig = {
  experimental: {
    reactCompiler: true,  // Or whatever value you had, e.g., { ...options }
  },
  // Lets the browser always call the API same-origin (relative /api/...)
  // instead of a baked-in host like localhost:8000, which breaks the
  // moment this is opened from anywhere other than the machine that built
  // it (a different device, or through the Caddy gateway on a LAN IP).
  // Caddy already proxies /api/* straight to the backend when traffic
  // comes through the :8080 gateway, so this rewrite only matters for
  // direct :3000 dev access - both paths end up same-origin either way.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
    ];
  },
  // Other config options...
};

export default nextConfig;