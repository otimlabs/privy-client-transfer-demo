import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import https from "https";
import type { IncomingMessage } from "http";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "fix-get-with-body",
      configureServer(server) {
        // Intercept GET /delegation/status and forward with body (browsers strip GET bodies)
        server.middlewares.use((req: IncomingMessage, res, next) => {
          if (req.method === "GET" && req.url?.includes("/delegation/status")) {
            const url = new URL(req.url || "", `http://${req.headers.host}`);
            const queryParams = Object.fromEntries(url.searchParams);
            
            if (!queryParams.address || !queryParams.chainId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Missing address or chainId in query params" }));
              return;
            }
            
            const bodyData = {
              address: queryParams.address,
              chainId: parseInt(queryParams.chainId, 10),
            };
            
            const body = Buffer.from(JSON.stringify(bodyData));
            const headers: Record<string, string> = {};
            
            // Copy headers (preserve Authorization, etc.)
            Object.entries(req.headers).forEach(([key, value]) => {
              const lowerKey = key.toLowerCase();
              if (!["host", "connection", "content-length", "transfer-encoding"].includes(lowerKey)) {
                if (typeof value === "string") {
                  headers[key] = value;
                } else if (Array.isArray(value) && value.length > 0) {
                  headers[key] = value[0];
                }
              }
            });
            
            headers["Content-Type"] = "application/json";
            headers["Content-Length"] = body.length.toString();
            
            // Forward as GET with body to API
            const proxyReq = https.request(
              {
                hostname: "api.otim.com",
                path: "/delegation/status",
                method: "GET",
                headers,
              },
              (proxyRes) => {
                Object.keys(proxyRes.headers).forEach((key) => {
                  const value = proxyRes.headers[key];
                  if (value && !res.headersSent) {
                    res.setHeader(key, Array.isArray(value) ? value[0] : value);
                  }
                });
                if (!res.headersSent) {
                  res.statusCode = proxyRes.statusCode || 200;
                }
                proxyRes.pipe(res);
              }
            );
            
            proxyReq.on("error", (error) => {
              console.error("[Proxy] Request error:", error);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "Proxy error" }));
              }
            });
            
            proxyReq.write(body);
            proxyReq.end();
            return;
          }
          
          next();
        });
      },
    },
  ],
  server: {
    proxy: {
      "/api": {
        target: "https://api.otim.com",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ""),
        bypass: (req) => {
          if (req.url?.includes("/delegation/status") && req.method === "GET") {
            return false; // Middleware handles this
          }
        },
      },
    },
  },
});
