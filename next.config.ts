import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // Temporarily disable PWA due to SW runtime error in production
  disable: true,
  register: false,
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA(nextConfig);
