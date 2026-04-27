import type { NextConfig } from "next"

const isDevelopment = process.env.NODE_ENV === "development"

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },

  async rewrites() {
    if (!isDevelopment) {
      return []
    }

    return {
      beforeFiles: [
        // ======================================================
        // 🏥 PRIMEY CARE PROVIDERS / CENTERS
        // ------------------------------------------------------
        // ✅ حل صريح لمشكلة 301 في صفحات المراكز
        // ✅ يحافظ على trailing slash المطلوب من Django
        // ======================================================
        {
          source: "/api/providers",
          destination: "http://127.0.0.1:8000/api/providers/",
        },
        {
          source: "/api/providers/",
          destination: "http://127.0.0.1:8000/api/providers/",
        },
        {
          source: "/api/providers/active",
          destination: "http://127.0.0.1:8000/api/providers/active/",
        },
        {
          source: "/api/providers/active/",
          destination: "http://127.0.0.1:8000/api/providers/active/",
        },
        {
          source: "/api/providers/:provider_id",
          destination: "http://127.0.0.1:8000/api/providers/:provider_id/",
        },
        {
          source: "/api/providers/:provider_id/",
          destination: "http://127.0.0.1:8000/api/providers/:provider_id/",
        },

        // ======================================================
        // 📦 SYSTEM PLANS
        // ======================================================
        {
          source: "/api/system/plans/admin",
          destination: "http://127.0.0.1:8000/api/system/plans/admin/",
        },
        {
          source: "/api/system/plans/admin/",
          destination: "http://127.0.0.1:8000/api/system/plans/admin/",
        },
        {
          source: "/api/system/plans/create",
          destination: "http://127.0.0.1:8000/api/system/plans/create/",
        },
        {
          source: "/api/system/plans/create/",
          destination: "http://127.0.0.1:8000/api/system/plans/create/",
        },
        {
          source: "/api/system/plans/:plan_id/update",
          destination: "http://127.0.0.1:8000/api/system/plans/:plan_id/update/",
        },
        {
          source: "/api/system/plans/:plan_id/update/",
          destination: "http://127.0.0.1:8000/api/system/plans/:plan_id/update/",
        },

        // ======================================================
        // 🔔 SYSTEM NOTIFICATIONS WS
        // ======================================================
        {
          source: "/ws/system/notifications",
          destination: "http://127.0.0.1:8000/ws/system/notifications/",
        },
        {
          source: "/ws/system/notifications/",
          destination: "http://127.0.0.1:8000/ws/system/notifications/",
        },

        // ======================================================
        // 🌐 GENERIC DEV PROXY
        // ------------------------------------------------------
        // يبقى آخر شيء حتى لا يسبق المسارات الصريحة أعلاه
        // ======================================================
        {
          source: "/api/:path*",
          destination: "http://127.0.0.1:8000/api/:path*",
        },
        {
          source: "/ws/:path*",
          destination: "http://127.0.0.1:8000/ws/:path*",
        },
      ],
    }
  },
}

export default nextConfig