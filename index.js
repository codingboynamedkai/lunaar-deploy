import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import fs from "fs";
import http from "http";
import https from "https";

const app = express();
let storedCookies = [];

const staticPath = path.join(process.cwd(), "static");

function serveFallback(res, errorMessage) {
  try {
    const html = fs
      .readFileSync(path.join(staticPath, "index.html"), "utf-8")
      .replace("{{ERROR_MESSAGE}}", errorMessage || "Something went wrong");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h1>Error</h1><p>${errorMessage}</p>`);
  }
}

const target = "https://lunaar.org";

app.use("/", async (req, res, next) => {
  const parsed = new URL(target);
  const options = {
    method: "HEAD",
    host: parsed.hostname,
    port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
    path: "/",
  };

  const protocol = parsed.protocol === "https:" ? https : http;

  const ping = protocol.request(options, (r) => {
    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
      onProxyReq(proxyReq) {
        if (storedCookies.length) {
          proxyReq.setHeader(
            "cookie",
            storedCookies.map((c) => `${c.name}=${c.value}`).join("; ")
          );
        }
      },
      onProxyRes(proxyRes) {
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
    });
    proxy(req, res, next);
  });

  ping.on("error", (err) => {
    console.error("Target unreachable:", err.message);
    serveFallback(res, err.message);
  });

  ping.end();
});

if (!process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`🌙 Lunaar (Self-Hosted) running at http://localhost:${PORT}`);
  });
}

export default app;
