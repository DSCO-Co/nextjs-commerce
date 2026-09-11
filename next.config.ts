export default {
  experimental: {
    // ppr is off: catalog reads go to the Flightdeck API at request time
    // (see `dynamic = "force-dynamic"` in app/layout.tsx), so there is no
    // static shell to prerender against a live API at build time.
    inlineCss: true,
    useCache: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        // Flightdeck exposes an opaque asset ref per product image; allow any
        // https host until the demo tenant's asset host is pinned down.
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};
