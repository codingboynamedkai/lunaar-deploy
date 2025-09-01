import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import fs from "fs";

const app = express();
let storedCookies = [];

const staticPath = path.join(process.cwd(), "static");

function serveFallback(res, errorMessage) {
  let html = fs.readFileSync(path.join(staticPath, "index.html"), "utf-8");
  html = html.replace("{{ERROR_MESSAGE}}", errorMessage);
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

app.use(
  "/",
  createProxyMiddleware({
    target: "https://lunaar.org",
    changeOrigin: true,
    ws: true,
    onProxyReq(proxyReq, req) {
      if (storedCookies.length) {
        proxyReq.setHeader(
          "cookie",
          storedCookies.map((c) => `${c.name}=${c.value}`).join("; ")
        );
      }
    },
    onProxyRes(proxyRes, req, res) {
      const cookies = proxyRes.headers["set-cookie"];
      if (cookies) {
        storedCookies = cookies.map((cookieStr) => {
          const [pair] = cookieStr.split(";");
          const [name, value] = pair.split("=");
          return { name, value };
        });
      }
    },
    onError(err, req, res) {
      console.error("Proxy error:", err.message);
      serveFallback(res, err.message);
    },
  })
);
if (!process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`🌙 Lunaar (Self-Hosted) running at http://localhost:${PORT}`);
  });
}

export default app;
