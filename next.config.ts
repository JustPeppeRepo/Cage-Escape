import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Stripe Checkout e' hosted (redirect). Analytics/Speed Insights: va.vercel-scripts.com.
// iubenda: cookie banner + autoblocking + embed policy (cdn/cs/www).
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com https://cdn.iubenda.com https://cs.iubenda.com;
  style-src 'self' 'unsafe-inline' https://cdn.iubenda.com;
  img-src 'self' blob: data: https://cdn.iubenda.com https://*.iubenda.com;
  media-src 'self';
  font-src 'self' https://cdn.iubenda.com;
  connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com https://*.iubenda.com;
  frame-src https://www.iubenda.com https://cdn.iubenda.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\n/g, ""),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Più restrittivo di origin-when-cross-origin: niente referrer su HTTPS→HTTP.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
        ],
      },
    ];
  },
};

export default nextConfig;
