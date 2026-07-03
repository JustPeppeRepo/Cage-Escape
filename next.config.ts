import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Nessuno script/iframe di terze parti e' caricato lato client (Stripe Checkout
// e' hosted: si naviga via redirect a checkout.stripe.com, non si carica
// js.stripe.com in pagina), quindi la CSP puo' restare stretta su 'self'.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

const nextConfig: NextConfig = {
  // Richiesto da next/navigation: forbidden()/unauthorized() (usati in
  // src/lib/dal.ts per proteggere /admin) sono ancora dietro un flag
  // sperimentale in questa versione di Next.js. Senza questo flag la
  // chiamata a forbidden() causa un runtime error invece di renderizzare
  // app/forbidden.tsx con uno status 403 pulito.
  experimental: {
    authInterrupts: true,
  },
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
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
