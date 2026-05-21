/* ============================================================
   📂 whatsapp_center/session_gateway/server.js
   🧠 Primey Care - WhatsApp Web Session Gateway
   ------------------------------------------------------------
   ✅ Express Gateway for Django WhatsApp Center
   ✅ Baileys WhatsApp Web session
   ✅ QR / Pairing Code / Status / Disconnect
   ✅ Auto reconnect for transient stream errors
   ✅ Multi-file auth per session
   ✅ Send Text / Send Document
   ✅ Compatible with whatsapp_center/client.py
============================================================ */

"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const pino = require("pino");
const QRCode = require("qrcode");
const { Boom } = require("@hapi/boom");

const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");

/* ============================================================
   Runtime Config
============================================================ */

const PORT = Number(process.env.PORT || process.env.WHATSAPP_GATEWAY_PORT || 3100);
const HOST = process.env.HOST || process.env.WHATSAPP_GATEWAY_HOST || "127.0.0.1";

const EXPECTED_TOKEN =
  process.env.WHATSAPP_SESSION_GATEWAY_TOKEN ||
  process.env.WHATSAPP_GATEWAY_TOKEN ||
  process.env.WHATSAPP_WEB_SESSION_GATEWAY_TOKEN ||
  "";

const DEFAULT_SESSION_NAME =
  process.env.WHATSAPP_DEFAULT_SESSION_NAME || "primey-care-system-session";

const SESSIONS_DIR =
  process.env.WHATSAPP_SESSIONS_DIR || path.join(__dirname, "sessions");

const REQUEST_BODY_LIMIT = process.env.WHATSAPP_GATEWAY_BODY_LIMIT || "10mb";

const QR_WAIT_TIMEOUT_MS = Number(process.env.WHATSAPP_QR_WAIT_TIMEOUT_MS || 45000);
const PAIRING_WAIT_TIMEOUT_MS = Number(process.env.WHATSAPP_PAIRING_WAIT_TIMEOUT_MS || 25000);
const RECONNECT_DELAY_MS = Number(process.env.WHATSAPP_RECONNECT_DELAY_MS || 2500);
const MAX_RECONNECT_ATTEMPTS = Number(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS || 8);

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

/* ============================================================
   App Bootstrap
============================================================ */

fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));

/* ============================================================
   In-memory Session Registry
============================================================ */

const sessions = new Map();

/* ============================================================
   Helpers
============================================================ */

function nowIso() {
  return new Date().toISOString();
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function safeSessionName(value) {
  const raw = safeString(value, DEFAULT_SESSION_NAME);

  return (
    raw
      .replace(/[^\w.-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 120) || DEFAULT_SESSION_NAME
  );
}

function sessionPath(sessionName) {
  return path.join(SESSIONS_DIR, safeSessionName(sessionName));
}

function normalizePhone(value) {
  return safeString(value).replace(/[^\d]/g, "");
}

function toWhatsAppJid(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  return `${digits}@s.whatsapp.net`;
}

function getBearerToken(req) {
  const header = safeString(req.headers.authorization);
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function requireGatewayAuth(req, res, next) {
  if (!EXPECTED_TOKEN) return next();

  const token = getBearerToken(req);

  if (token !== EXPECTED_TOKEN) {
    return res.status(401).json({
      success: false,
      status_code: 401,
      message: "Unauthorized gateway request",
      provider_status: "unauthorized",
    });
  }

  return next();
}

function successPayload(payload = {}) {
  return {
    success: true,
    status_code: 200,
    ...payload,
  };
}

function errorPayload(statusCode, message, extra = {}) {
  return {
    success: false,
    status_code: statusCode,
    message,
    error_message: message,
    ...extra,
  };
}

function getDisconnectReason(lastDisconnect) {
  try {
    const error = lastDisconnect?.error;
    const boom = error instanceof Boom ? error : new Boom(error);
    return boom?.output?.statusCode;
  } catch {
    return undefined;
  }
}

function getDisconnectMessage(lastDisconnect) {
  return safeString(
    lastDisconnect?.error?.message ||
      lastDisconnect?.error?.output?.payload?.message ||
      lastDisconnect?.error?.output?.payload?.error,
    "Session closed",
  );
}

function shouldReconnect(reason) {
  if (!reason) return true;

  const noReconnectReasons = new Set([
    DisconnectReason.loggedOut,
    DisconnectReason.badSession,
    DisconnectReason.forbidden,
    DisconnectReason.multideviceMismatch,
  ]);

  return !noReconnectReasons.has(reason);
}

function hasCredentials(sessionName) {
  const dir = sessionPath(sessionName);
  if (!fs.existsSync(dir)) return false;

  const files = fs.readdirSync(dir);
  return files.some((name) => name.includes("creds"));
}

function removeSessionFiles(sessionName) {
  const dir = sessionPath(sessionName);

  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function closeSocketQuietly(sock) {
  if (!sock) return;

  try {
    sock.ev?.removeAllListeners?.("connection.update");
    sock.ev?.removeAllListeners?.("creds.update");
    sock.ev?.removeAllListeners?.("messages.upsert");
  } catch {
    // ignore
  }

  try {
    sock.end?.();
  } catch {
    // ignore
  }

  try {
    sock.ws?.close?.();
  } catch {
    // ignore
  }
}

function getSessionSnapshot(sessionName) {
  const name = safeSessionName(sessionName);
  const session = sessions.get(name);

  if (!session) {
    return {
      session_name: name,
      session_status: hasCredentials(name) ? "disconnected" : "disconnected",
      connected: false,
      connected_phone: "",
      device_label: "",
      qr_code: "",
      pairing_code: "",
      last_connected_at: "",
      message: "Session is not connected",
    };
  }

  return {
    session_name: session.name,
    session_status: session.status || "disconnected",
    connected: Boolean(session.connected),
    connected_phone: session.connectedPhone || "",
    device_label: session.deviceLabel || "",
    qr_code: session.qrDataUrl || session.qr || "",
    pairing_code: session.pairingCode || "",
    last_connected_at: session.lastConnectedAt || "",
    message: session.lastError || "",
    reconnect_attempts: session.reconnectAttempts || 0,
  };
}

function waitForCondition(checkFn, timeoutMs, intervalMs = 500) {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    const timer = setInterval(() => {
      const result = checkFn();

      if (result) {
        clearInterval(timer);
        resolve(result);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        resolve(null);
      }
    }, intervalMs);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ============================================================
   Session Core
============================================================ */

function createEmptySession(name) {
  return {
    name,
    sock: null,
    status: "initializing",
    connected: false,
    connectedPhone: "",
    deviceLabel: "",
    qr: "",
    qrDataUrl: "",
    pairingCode: "",
    lastConnectedAt: "",
    lastError: "",
    initPromise: null,
    saveCreds: null,
    reconnectAttempts: 0,
    reconnectTimer: null,
    manuallyClosed: false,
  };
}

async function scheduleReconnect(sessionName, reason, errorMessage) {
  const name = safeSessionName(sessionName);
  const session = sessions.get(name);

  if (!session || session.manuallyClosed) return;

  if (session.reconnectTimer) return;

  if (session.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    session.status = "failed";
    session.connected = false;
    session.lastError = `Reconnect attempts exceeded. Last reason: ${reason || "unknown"} ${errorMessage || ""}`.trim();

    logger.error(
      {
        session: name,
        attempts: session.reconnectAttempts,
        reason,
        error: session.lastError,
      },
      "WhatsApp session reconnect limit reached",
    );
    return;
  }

  session.reconnectAttempts += 1;
  session.status = "reconnecting";
  session.connected = false;
  session.lastError = errorMessage || "Reconnecting session";

  logger.warn(
    {
      session: name,
      attempt: session.reconnectAttempts,
      max_attempts: MAX_RECONNECT_ATTEMPTS,
      reason,
      delay_ms: RECONNECT_DELAY_MS,
    },
    "Scheduling WhatsApp session reconnect",
  );

  session.reconnectTimer = setTimeout(async () => {
    const current = sessions.get(name);
    if (!current || current.manuallyClosed) return;

    current.reconnectTimer = null;
    current.sock = null;
    current.initPromise = null;

    try {
      await ensureSession(name, { mode: "qr", reconnect: true });
    } catch (error) {
      current.status = "failed";
      current.lastError = safeString(error?.message, "Reconnect failed");
      logger.error({ error, session: name }, "WhatsApp reconnect failed");
    }
  }, RECONNECT_DELAY_MS);
}

async function ensureSession(sessionName, options = {}) {
  const name = safeSessionName(sessionName);
  const mode = safeString(options.mode, "qr");

  let session = sessions.get(name);

  if (session?.sock && !options.forceRestart) {
    return session;
  }

  if (session?.initPromise) {
    await session.initPromise;
    return sessions.get(name);
  }

  if (!session || options.forceRestart) {
    if (session?.sock) {
      closeSocketQuietly(session.sock);
    }

    session = createEmptySession(name);
    sessions.set(name, session);
  }

  session.manuallyClosed = false;

  session.initPromise = (async () => {
    const authDir = sessionPath(name);
    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    session.saveCreds = saveCreds;

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          pino({ level: process.env.BAILEYS_LOG_LEVEL || "silent" }),
        ),
      },
      printQRInTerminal: false,
      browser: ["Desktop", "Chrome", "121.0.0"],
      logger: pino({ level: process.env.BAILEYS_LOG_LEVEL || "silent" }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      defaultQueryTimeoutMs: 60000,
      emitOwnEvents: false,
      fireInitQueries: true,
      shouldSyncHistoryMessage: () => false,
    });

    session.sock = sock;
    session.status = mode === "pairing_code" ? "pair_pending" : "qr_pending";

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.qr = qr;
        session.status = "qr_pending";
        session.connected = false;
        session.pairingCode = "";
        session.lastError = "";

        try {
          session.qrDataUrl = await QRCode.toDataURL(qr, {
            margin: 1,
            scale: 8,
          });
        } catch (error) {
          logger.error({ error }, "Failed to convert QR to data URL");
          session.qrDataUrl = qr;
        }
      }

      if (connection === "connecting") {
        if (!session.connected) {
          session.status = session.qr || session.qrDataUrl ? "qr_pending" : "connecting";
        }
      }

      if (connection === "open") {
        const user = sock.user || {};

        session.status = "connected";
        session.connected = true;
        session.connectedPhone = normalizePhone(user.id || user.jid || "");
        session.deviceLabel = safeString(user.name || user.verifiedName || "WhatsApp Web");
        session.lastConnectedAt = nowIso();
        session.lastError = "";
        session.qr = "";
        session.qrDataUrl = "";
        session.pairingCode = "";
        session.reconnectAttempts = 0;

        if (session.reconnectTimer) {
          clearTimeout(session.reconnectTimer);
          session.reconnectTimer = null;
        }

        logger.info(
          {
            session: name,
            connected_phone: session.connectedPhone,
            device_label: session.deviceLabel,
          },
          "WhatsApp session connected",
        );
      }

      if (connection === "close") {
        const reason = getDisconnectReason(lastDisconnect);
        const errorMessage = getDisconnectMessage(lastDisconnect);
        const loggedOut = reason === DisconnectReason.loggedOut;
        const badSession = reason === DisconnectReason.badSession;
        const permanent = loggedOut || badSession;

        session.connected = false;
        session.sock = null;

        logger.warn(
          {
            session: name,
            reason,
            error: errorMessage,
            permanent,
          },
          "WhatsApp session closed",
        );

        if (permanent) {
          session.status = "disconnected";
          session.lastError = loggedOut ? "Session logged out" : errorMessage;
          sessions.delete(name);
          removeSessionFiles(name);
          return;
        }

        if (shouldReconnect(reason)) {
          session.status = "reconnecting";
          session.lastError = errorMessage || "Session reconnecting";
          await scheduleReconnect(name, reason, errorMessage);
          return;
        }

        session.status = "failed";
        session.lastError = errorMessage;
      }
    });

    sock.ev.on("messages.upsert", (event) => {
      if (!event || !Array.isArray(event.messages)) return;

      for (const message of event.messages) {
        if (!message || message.key?.fromMe) continue;

        logger.info(
          {
            session: name,
            message_id: message.key?.id,
            remote_jid: message.key?.remoteJid,
          },
          "Inbound WhatsApp message received",
        );
      }
    });

    return session;
  })();

  try {
    await session.initPromise;
  } finally {
    session.initPromise = null;
  }

  return session;
}

async function createQrSession(sessionName) {
  const name = safeSessionName(sessionName);
  const session = await ensureSession(name, { mode: "qr" });

  if (session.connected) {
    return successPayload({
      session_name: name,
      session_status: "connected",
      connected: true,
      connected_phone: session.connectedPhone,
      device_label: session.deviceLabel,
      last_connected_at: session.lastConnectedAt,
      message: "Session is already connected",
    });
  }

  const qrResult = await waitForCondition(() => {
    const current = sessions.get(name);

    if (!current) return null;
    if (current.connected) return current;
    if (current.qrDataUrl || current.qr) return current;
    if (current.status === "reconnecting") return current;

    return null;
  }, QR_WAIT_TIMEOUT_MS);

  const current = qrResult || sessions.get(name);

  if (current?.connected) {
    return successPayload({
      session_name: name,
      session_status: "connected",
      connected: true,
      connected_phone: current.connectedPhone,
      device_label: current.deviceLabel,
      last_connected_at: current.lastConnectedAt,
      message: "Session is connected",
    });
  }

  if (!current?.qrDataUrl && !current?.qr) {
    return errorPayload(408, "QR was not generated before timeout", {
      session_name: name,
      session_status: current?.status || "failed",
      connected: false,
      gateway_message: current?.lastError || "",
    });
  }

  return successPayload({
    session_name: name,
    session_status: current.status || "qr_pending",
    connected: false,
    qr_code: current.qrDataUrl || current.qr,
    message: current.lastError || "QR session created successfully",
  });
}

async function createPairingCodeSession(sessionName, phoneNumber) {
  const name = safeSessionName(sessionName);
  const cleanPhone = normalizePhone(phoneNumber);

  if (!cleanPhone) {
    return errorPayload(400, "phone_number is required", {
      session_name: name,
      session_status: "failed",
      connected: false,
    });
  }

  const session = await ensureSession(name, { mode: "pairing_code" });

  if (session.connected) {
    return successPayload({
      session_name: name,
      session_status: "connected",
      connected: true,
      connected_phone: session.connectedPhone,
      device_label: session.deviceLabel,
      last_connected_at: session.lastConnectedAt,
      message: "Session is already connected",
    });
  }

  if (!session.sock || typeof session.sock.requestPairingCode !== "function") {
    return errorPayload(500, "Pairing code is not supported by this socket version", {
      session_name: name,
      session_status: "failed",
      connected: false,
    });
  }

  try {
    await sleep(1200);

    const code = await session.sock.requestPairingCode(cleanPhone);

    session.pairingCode = safeString(code);
    session.status = "pair_pending";
    session.qr = "";
    session.qrDataUrl = "";

    return successPayload({
      session_name: name,
      session_status: "pair_pending",
      connected: false,
      pairing_code: session.pairingCode,
      message: "Pairing code created successfully",
    });
  } catch (error) {
    const message = safeString(error?.message, "Failed to create pairing code");

    session.status = "failed";
    session.lastError = message;

    return errorPayload(400, message, {
      session_name: name,
      session_status: "failed",
      connected: false,
    });
  }
}

async function disconnectSession(sessionName) {
  const name = safeSessionName(sessionName);
  const session = sessions.get(name);

  try {
    if (session) {
      session.manuallyClosed = true;

      if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
      }

      if (session.sock) {
        try {
          await session.sock.logout();
        } catch {
          closeSocketQuietly(session.sock);
        }
      }
    }

    sessions.delete(name);
    removeSessionFiles(name);

    return successPayload({
      session_name: name,
      session_status: "disconnected",
      connected: false,
      message: "Session disconnected successfully",
    });
  } catch (error) {
    return errorPayload(500, safeString(error?.message, "Failed to disconnect session"), {
      session_name: name,
      session_status: "failed",
      connected: false,
    });
  }
}

async function sendTextMessage(sessionName, toPhone, body) {
  const name = safeSessionName(sessionName);
  const jid = toWhatsAppJid(toPhone);
  const text = safeString(body);

  if (!jid || !text) {
    return errorPayload(400, "Missing to_phone or body", {
      provider_status: "validation_failed",
    });
  }

  const session = await ensureSession(name, { mode: "qr" });

  if (!session.connected || !session.sock) {
    return errorPayload(400, "WhatsApp session is not connected", {
      session_name: name,
      session_status: session.status || "disconnected",
      connected: false,
      provider_status: "gateway_failed",
    });
  }

  try {
    const result = await session.sock.sendMessage(jid, { text });

    return successPayload({
      provider_status: "sent",
      external_message_id: result?.key?.id || "",
      message_id: result?.key?.id || "",
      session_name: name,
      session_status: "connected",
      connected: true,
      message: "Text message sent successfully",
    });
  } catch (error) {
    return errorPayload(500, safeString(error?.message, "Failed to send text message"), {
      provider_status: "gateway_failed",
      session_name: name,
    });
  }
}

async function sendDocumentMessage(sessionName, toPhone, documentUrl, caption, filename) {
  const name = safeSessionName(sessionName);
  const jid = toWhatsAppJid(toPhone);
  const cleanUrl = safeString(documentUrl);

  if (!jid || !cleanUrl) {
    return errorPayload(400, "Missing to_phone or document_url", {
      provider_status: "validation_failed",
    });
  }

  const session = await ensureSession(name, { mode: "qr" });

  if (!session.connected || !session.sock) {
    return errorPayload(400, "WhatsApp session is not connected", {
      session_name: name,
      session_status: session.status || "disconnected",
      connected: false,
      provider_status: "gateway_failed",
    });
  }

  try {
    const result = await session.sock.sendMessage(jid, {
      document: { url: cleanUrl },
      mimetype: "application/pdf",
      fileName: safeString(filename, "document.pdf"),
      caption: safeString(caption),
    });

    return successPayload({
      provider_status: "sent",
      external_message_id: result?.key?.id || "",
      message_id: result?.key?.id || "",
      session_name: name,
      session_status: "connected",
      connected: true,
      message: "Document message sent successfully",
    });
  } catch (error) {
    return errorPayload(500, safeString(error?.message, "Failed to send document message"), {
      provider_status: "gateway_failed",
      session_name: name,
    });
  }
}

/* ============================================================
   Routes
============================================================ */

app.get("/", (_req, res) => {
  res.json(
    successPayload({
      service: "Primey Care WhatsApp Session Gateway",
      status: "ok",
      port: PORT,
      sessions_count: sessions.size,
    }),
  );
});

app.get("/health", (_req, res) => {
  res.json(
    successPayload({
      status: "healthy",
      service: "primeycare-whatsapp-session-gateway",
      sessions_count: sessions.size,
      time: nowIso(),
    }),
  );
});

app.use(requireGatewayAuth);

app.post(["/session/status", "/session/status/"], async (req, res) => {
  const sessionName = safeSessionName(req.body?.session_name);

  try {
    if (hasCredentials(sessionName) && !sessions.has(sessionName)) {
      await ensureSession(sessionName, { mode: "qr" });
      await sleep(1200);
    }

    return res.json(
      successPayload({
        ...getSessionSnapshot(sessionName),
      }),
    );
  } catch (error) {
    return res.status(503).json(
      errorPayload(503, safeString(error?.message, "Failed to get session status"), {
        session_name: sessionName,
        session_status: "failed",
        connected: false,
      }),
    );
  }
});

app.post(["/session/create-qr", "/session/create-qr/"], async (req, res) => {
  const sessionName = safeSessionName(req.body?.session_name);

  const payload = await createQrSession(sessionName);

  return res.status(payload.success ? 200 : payload.status_code || 400).json(payload);
});

app.post(
  ["/session/create-pairing-code", "/session/create-pairing-code/"],
  async (req, res) => {
    const sessionName = safeSessionName(req.body?.session_name);
    const phoneNumber = req.body?.phone_number;

    const payload = await createPairingCodeSession(sessionName, phoneNumber);

    return res.status(payload.success ? 200 : payload.status_code || 400).json(payload);
  },
);

app.post(["/session/disconnect", "/session/disconnect/"], async (req, res) => {
  const sessionName = safeSessionName(req.body?.session_name);

  const payload = await disconnectSession(sessionName);

  return res.status(payload.success ? 200 : payload.status_code || 400).json(payload);
});

app.post(["/messages/send-text", "/messages/send-text/"], async (req, res) => {
  const sessionName = safeSessionName(req.body?.session_name);
  const toPhone = req.body?.to_phone;
  const body = req.body?.body;

  const payload = await sendTextMessage(sessionName, toPhone, body);

  return res.status(payload.success ? 200 : payload.status_code || 400).json(payload);
});

app.post(["/messages/send-document", "/messages/send-document/"], async (req, res) => {
  const sessionName = safeSessionName(req.body?.session_name);
  const toPhone = req.body?.to_phone;
  const documentUrl = req.body?.document_url;
  const caption = req.body?.caption;
  const filename = req.body?.filename;

  const payload = await sendDocumentMessage(
    sessionName,
    toPhone,
    documentUrl,
    caption,
    filename,
  );

  return res.status(payload.success ? 200 : payload.status_code || 400).json(payload);
});

/* ============================================================
   Error Handler
============================================================ */

app.use((error, _req, res, _next) => {
  logger.error({ error }, "Unhandled gateway error");

  return res.status(500).json(
    errorPayload(500, "Unexpected gateway error", {
      details: safeString(error?.message),
    }),
  );
});

/* ============================================================
   Start Server
============================================================ */

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  logger.info(
    {
      host: HOST,
      port: PORT,
      sessions_dir: SESSIONS_DIR,
      auth_enabled: Boolean(EXPECTED_TOKEN),
    },
    "Primey Care WhatsApp Session Gateway started",
  );
});

/* ============================================================
   Graceful Shutdown
============================================================ */

function shutdown(signal) {
  logger.info({ signal }, "Shutting down WhatsApp Session Gateway");

  for (const session of sessions.values()) {
    try {
      session.manuallyClosed = true;

      if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
      }

      closeSocketQuietly(session.sock);
    } catch {
      // ignore
    }
  }

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);