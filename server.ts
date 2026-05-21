import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  setupTablesIfMissing,
  getClientes,
  saveCliente,
  deleteCliente,
  getConfig,
  saveConfig,
  getRecibos,
  saveRecibo,
  deleteRecibo,
  getDbStatus,
  getPagos,
  savePago,
  deletePago
} from "./server_db";

const app = express();
const PORT = 3000;

// Resolve CJS-like directory structures in standard ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware to parse JSON bodies
app.use(express.json({ limit: "15mb" }));

// Helper to resolve temporary dynamic credentials from headers
function getCredentialsFromHeaders(req: express.Request) {
  let accessKeyId = req.headers["x-aws-access-key-id"] as string;
  let secretAccessKey = req.headers["x-aws-secret-access-key"] as string;
  let sessionToken = req.headers["x-aws-session-token"] as string;
  let tenantId = req.headers["x-tenant-id"] as string;

  const clean = (val: string | undefined | null) => {
    if (!val) return undefined;
    const s = String(val).trim();
    if (s === "" || s === "undefined" || s === "null") return undefined;
    return s;
  };

  accessKeyId = clean(accessKeyId) as string;
  secretAccessKey = clean(secretAccessKey) as string;
  sessionToken = clean(sessionToken) as string;
  tenantId = clean(tenantId) as string;

  if (accessKeyId && secretAccessKey) {
    return {
      accessKeyId,
      secretAccessKey,
      sessionToken,
      tenantId
    };
  }
  // Fall back to tenantId-only configuration if static AWS keys are active in servers env
  if (tenantId) {
    return {
      accessKeyId: clean(process.env.AWS_ACCESS_KEY_ID) || "",
      secretAccessKey: clean(process.env.AWS_SECRET_ACCESS_KEY) || "",
      tenantId
    };
  }
  return undefined;
}

// Initialize tables immediately using default static environment (or local)
setupTablesIfMissing().then((status) => {
  console.log(`📡 Database system initialized. Default Operating mode: [${status.mode.toUpperCase()}]`);
  if (status.mode === "local") {
    console.log(`ℹ️ Fallback active: ${status.error}`);
  }
});

// --- API ROUTES ---

// 0. Login Proxy (bypasses browser CORS / sandbox constraints within iframes)
app.post("/api/login", async (req, res) => {
  try {
    const { tenantId, username, password } = req.body;
    const response = await fetch("https://b9srulj4f8.execute-api.us-east-1.amazonaws.com/prod/loginUser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tenantId, username, password })
    });

    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { message: text };
    }

    if (!response.ok) {
      return res.status(response.status).json(body);
    }

    console.log("🔐 Autenticación exitosa. Estructura de respuesta de Amazon API Gateway:", {
      status: response.status,
      keys: Object.keys(body),
      hasAccessKey: !!(body.accessKeyId || body.AccessKeyId || body.accesskeyid),
      hasSecretKey: !!(body.secretAccessKey || body.SecretAccessKey || body.secretaccesskey),
      hasSessionToken: !!(body.sessionToken || body.SessionToken || body.sessiontoken),
      hasJwt: !!(body.jwt || body.Jwt || body.token || body.Token),
      tenantId: tenantId
    });

    res.json(body);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Error al contactar el servidor de autenticación" });
  }
});

// 1. Health & Database Status
app.get("/api/status", (req, res) => {
  const credentials = getCredentialsFromHeaders(req);
  res.json(getDbStatus(credentials));
});

// Explicit setup trigger after user has logged-in to ensure new tables (detektor_pagos, etc) exist in their account
app.post("/api/setup", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const result = await setupTablesIfMissing(credentials);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to trigger table creation" });
  }
});

// 2. Clientes
app.get("/api/clientes", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const list = await getClientes(credentials);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch clients" });
  }
});

app.post("/api/clientes", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const clientData = req.body;
    if (!clientData.id || !clientData.nombre) {
      return res.status(400).json({ error: "Missing required fields: id, nombre" });
    }
    const success = await saveCliente(clientData, credentials);
    res.json({ success, client: clientData });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save client" });
  }
});

app.delete("/api/clientes/:id", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const id = req.params.id;
    const success = await deleteCliente(id, credentials);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete client" });
  }
});

// 3. Config
app.get("/api/config", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const key = req.query.key as string;
    if (!key) {
      return res.status(400).json({ error: "Missing key query parameter" });
    }
    const value = await getConfig(key, credentials);
    res.json({ key, value });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch configuration" });
  }
});

app.post("/api/config", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ error: "Missing required config elements: key" });
    }
    const success = await saveConfig(key, value, credentials);
    res.json({ success, key });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save configuration" });
  }
});

// 4. Custom Receipts (Recibos Personalizados)
app.get("/api/recibos", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const list = await getRecibos(credentials);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch custom receipts" });
  }
});

app.post("/api/recibos", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const reciboData = req.body;
    if (!reciboData.id || !reciboData.numeroRecibo || !reciboData.clienteNombre) {
      return res.status(400).json({ error: "Missing required fields: id, numeroRecibo, clienteNombre" });
    }
    const success = await saveRecibo(reciboData, credentials);
    res.json({ success, recibo: reciboData });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save custom receipt" });
  }
});

app.delete("/api/recibos/:id", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const id = req.params.id;
    const success = await deleteRecibo(id, credentials);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete custom receipt" });
  }
});

// 5. Pagos (New Payments Table Endpoints)
app.get("/api/pagos", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const list = await getPagos(credentials);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch payments" });
  }
});

app.post("/api/pagos", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const pagoData = req.body;
    if (!pagoData.monto || !pagoData.recibo) {
      return res.status(400).json({ error: "Missing required fields: monto, recibo" });
    }
    const success = await savePago(pagoData, credentials);
    res.json({ success, pago: pagoData });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save payment" });
  }
});

app.delete("/api/pagos/:id", async (req, res) => {
  try {
    const credentials = getCredentialsFromHeaders(req);
    const id = req.params.id;
    const success = await deletePago(id, credentials);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete payment" });
  }
});

// Serve frontend assets
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  console.log(`📂 Serving compiled SPA from: ${distPath}`);
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  console.log("⚠️ /dist build directory not found. Serving development placeholder. Compile frontend first.");
  app.get("/", (req, res) => {
    res.send("<h1>Server running!</h1><p>Please compile the React frontend using <code>npm run build</code>.</p>");
  });
}

// Port is hardcoded to 3000 as per Guidelines
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Fully-featured payment backend running on http://localhost:${PORT}`);
});
