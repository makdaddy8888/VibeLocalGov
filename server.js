/**
 * Local static server + optional POST to save Vibe prompt as Markdown under ./md/<council-key>/
 * Usage: node server.js
 * Env: PORT (default 3000), HOST (optional)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const root = path.resolve(__dirname);
const args = process.argv.slice(2);
const OPEN_BROWSER = process.env.OPEN === "1" || args.indexOf("--open") !== -1;
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST;
const MD_ROOT = path.join(root, "md");
const MAX_BODY = 1_500_000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

function safeResolve(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  if (decoded.includes("\0")) return null;
  const rel = decoded.replace(/^[\/]+/, "") || "index.html";
  const rootResolved = path.resolve(root);
  const joined = path.resolve(root, rel);
  if (joined === rootResolved) {
    return path.join(rootResolved, "index.html");
  }
  if (joined.length < rootResolved.length) return null;
  if (!joined.toLowerCase().startsWith(rootResolved.toLowerCase() + path.sep)) {
    if (joined.toLowerCase() !== rootResolved.toLowerCase()) return null;
  }
  return joined;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, function (err, data) {
    if (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Error reading file");
      }
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  });
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function readBody(req, done) {
  var bufs = [];
  var n = 0;
  req.on("data", function (chunk) {
    n += chunk.length;
    if (n > MAX_BODY) {
      req.destroy();
      done(new Error("Payload too large"));
    } else {
      bufs.push(chunk);
    }
  });
  req.on("end", function () {
    done(null, Buffer.concat(bufs).toString("utf8"));
  });
  req.on("error", function (e) {
    done(e);
  });
}

function isValidCouncilKey(k) {
  if (!k || k.length < 1 || k.length > 64) return false;
  if (!/^[a-z0-9-]+$/.test(k)) return false;
  if (k.charAt(0) === "-" || k.slice(-1) === "-") return false;
  return true;
}

function handleSavePrompt(req, res) {
  if (req.headers["content-type"] && !String(req.headers["content-type"]).includes("json")) {
    return sendJson(res, 400, { ok: false, error: "Content-Type must be application/json" });
  }
  readBody(req, function (err, raw) {
    if (err && err.message === "Payload too large") {
      return sendJson(res, 413, { ok: false, error: "Payload too large" });
    }
    if (err) {
      return sendJson(res, 400, { ok: false, error: "Could not read body" });
    }
    var body;
    try {
      body = JSON.parse(raw || "{}");
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON" });
    }
    var key = (body.councilKey || "").toString().trim().toLowerCase();
    if (!isValidCouncilKey(key)) {
      return sendJson(res, 400, { ok: false, error: "Invalid councilKey (lowercase, letters, numbers, hyphens; 1–64 chars)." });
    }
    var md = (body.markdown || "").toString();
    if (!md) {
      return sendJson(res, 400, { ok: false, error: "Missing markdown" });
    }
    var sub = path.join(MD_ROOT, key);
    fs.mkdir(sub, { recursive: true }, function (mkErr) {
      if (mkErr) {
        return sendJson(res, 500, { ok: false, error: mkErr.message });
      }
      var safeLabel = (body.fileLabel || "vibe-prompt")
        .toString()
        .replace(/[^a-z0-9_-]/gi, "-")
        .replace(/-+/g, "-")
        .slice(0, 64);
      if (!safeLabel) safeLabel = "vibe-prompt";
      var stamp = (body.stamp || new Date().toISOString().replace(/[:.]/g, "-")).toString();
      var fname = safeLabel + "-" + stamp + ".md";
      var fpath = path.join(sub, fname);
      fs.writeFile(fpath, md, { encoding: "utf8" }, function (wErr) {
        if (wErr) {
          return sendJson(res, 500, { ok: false, error: wErr.message });
        }
        return sendJson(res, 200, {
          ok: true,
          relativeFile: "md/" + key + "/" + fname,
          absolutePath: fpath,
        });
      });
    });
  });
}

function tryServeGet(req, res) {
  var pathname = (req.url || "/").split("?")[0] || "/";
  if (pathname === "/") pathname = "/index.html";

  var filePath = safeResolve(pathname);
  if (!filePath) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Bad request");
  }

  fs.stat(filePath, function (err, st) {
    if (err) {
      if (pathname !== "/index.html" && !path.extname(pathname)) {
        var asHtml = safeResolve(pathname + ".html");
        if (asHtml) {
          return fs.stat(asHtml, function (e2, st2) {
            if (!e2 && st2.isFile()) {
              if (req.method === "HEAD") {
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                return res.end();
              }
              return sendFile(res, asHtml);
            }
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not found");
          });
        }
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }

    if (st.isDirectory()) {
      var index = path.join(filePath, "index.html");
      return fs.stat(index, function (e3) {
        if (e3) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          return res.end("Not found");
        }
        if (req.method === "HEAD") {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          return res.end();
        }
        return sendFile(res, index);
      });
    }

    if (!st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }

    if (req.method === "HEAD") {
      var ex = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ex] || "application/octet-stream" });
      return res.end();
    }
    return sendFile(res, filePath);
  });
}

const server = http.createServer(function (req, res) {
  var p = (req.url || "/").split("?")[0] || "/";
  if (req.method === "POST" && p === "/api/save-prompt") {
    return handleSavePrompt(req, res);
  }
  if (req.method === "GET" || req.method === "HEAD") {
    return tryServeGet(req, res);
  }
  if (req.method === "OPTIONS" && p === "/api/save-prompt") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }
  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD, POST, OPTIONS" });
  res.end("Method not allowed");
});

function onListening() {
  var port = (server.address() && server.address().port) || PORT;
  console.log("");
  console.log("=== VibeLocalGov (local) ===");
  console.log("Use this URL first (most reliable on Mac/Windows):");
  console.log("  http://127.0.0.1:" + port + "/");
  console.log("Or:");
  console.log("  http://localhost:" + port + "/");
  console.log("Project folder: " + root);
  console.log("Markdown save API: POST /api/save-prompt  →  ./md/<council-key>/");
  console.log("Keep this terminal open while you browse. Ctrl+C to stop.");
  console.log("");

  var selfUrl = "http://127.0.0.1:" + port + "/";
  http.get(selfUrl, function (r) {
    var ok = r.statusCode === 200;
    console.log("[self-test] " + selfUrl + " -> HTTP " + r.statusCode + (ok ? " (OK)" : " (unexpected)"));
    r.resume();
    if (OPEN_BROWSER && ok) {
      var q = JSON.stringify(selfUrl);
      var cmd =
        process.platform === "win32"
          ? "cmd /c start \"\" " + q
          : process.platform === "darwin"
            ? "open " + q
            : "xdg-open " + q;
      exec(cmd, function (e) {
        if (e) console.log("(Could not open browser. Paste the URL above into Chrome or Edge.)");
      });
    }
  }).on("error", function (e) {
    console.log("[self-test] failed: " + (e && e.message));
  });
}

function startListening(bindHost) {
  server.removeAllListeners("error");
  server.once("error", function (err) {
    if (err && err.code === "EADDRINUSE") {
      console.error("Port " + PORT + " is already in use. Another terminal may be running the server.");
      console.error("Stop it, or run:  PORT=3001 node server.js");
      process.exit(1);
    }
    if (bindHost === "::" && (err.code === "EAFNOSUPPORT" || err.code === "EADDRNOTAVAIL" || err.code === "EINVAL")) {
      startListening("0.0.0.0");
      return;
    }
    console.error("Listen error (" + (bindHost || "") + "): " + (err && err.message));
    process.exit(1);
  });
  server.listen(PORT, bindHost, onListening);
}

if (HOST) {
  startListening(HOST);
} else {
  startListening("::");
}
