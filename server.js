const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
const port = Number(process.env.PORT) || 3000;
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "backend.json");
let sql;
let databaseReady;

const defaultExam = {
  id: "EX-2026",
  name: "Fundamentals of Computing",
  durationSeconds: 30 * 60,
};

function readData() {
  try {
    const value = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return {
      exams: Array.isArray(value.exams) ? value.exams : [],
      sessions: value.sessions && typeof value.sessions === "object" ? value.sessions : {},
      submissions: Array.isArray(value.submissions) ? value.submissions : [],
    };
  } catch {
    return { exams: [], sessions: {}, submissions: [] };
  }
}

function writeData(data) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

async function getDatabase() {
  if (!process.env.DATABASE_URL) {
    if (process.env.VERCEL) {
      const error = new Error(
        "DATABASE_URL is not configured. Add your Neon connection string in Vercel project environment variables.",
      );
      error.statusCode = 503;
      throw error;
    }
    return null;
  }

  if (!sql) {
    const { neon } = require("@neondatabase/serverless");
    sql = neon(process.env.DATABASE_URL);
  }
  if (!databaseReady) {
    databaseReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS verity_exams (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS verity_sessions (
          session_id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS verity_submissions (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          payload JSONB NOT NULL,
          submitted_at TIMESTAMPTZ NOT NULL
        )
      `;
    })().catch((error) => {
      databaseReady = null;
      throw error;
    });
  }
  await databaseReady;
  return sql;
}

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  if (req.path !== "/api/index") return next();

  const requestUrl = new URL(req.originalUrl, "http://localhost");
  const apiPath = requestUrl.searchParams.get("path");
  if (!apiPath) return next();

  requestUrl.searchParams.delete("path");
  req.url = `/api/${apiPath}${requestUrl.search}`;
  next();
});

app.get("/api/health", async (req, res) => {
  const database = await getDatabase();
  if (database) await database`SELECT 1`;
  res.json({ ok: true });
});

app.get("/api/rtc-config", (req, res) => {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  const turnUrls = String(process.env.TURN_URL || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (turnUrls.length) {
    if (!process.env.TURN_USERNAME || !process.env.TURN_CREDENTIAL)
      return res.status(500).json({
        error: "TURN_URL requires TURN_USERNAME and TURN_CREDENTIAL.",
      });
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }
  res.json({ iceServers });
});

app.get("/api/exams", async (req, res) => {
  const database = await getDatabase();
  if (database) {
    const exams = await database`
      SELECT id, name, duration_seconds
      FROM verity_exams
      ORDER BY id
    `;
    return res.json([
      defaultExam,
      ...exams
        .filter((exam) => exam.id !== defaultExam.id)
        .map((exam) => ({
          id: exam.id,
          name: exam.name,
          durationSeconds: exam.duration_seconds,
        })),
    ]);
  }
  const data = readData();
  res.json([defaultExam, ...data.exams.filter((exam) => exam.id !== defaultExam.id)]);
});

app.post("/api/exams", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const minutes = Number(req.body.minutes);
  if (!name || !Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    return res.status(400).json({ error: "A test name and duration from 1 to 240 minutes are required." });
  }

  const database = await getDatabase();
  const data = database ? null : readData();
  const exams = database
    ? null
    : [defaultExam, ...data.exams.filter((exam) => exam.id !== defaultExam.id)];
  let id;
  do {
    id = `EX-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  } while (exams?.some((exam) => exam.id === id));

  const exam = { id, name, durationSeconds: minutes * 60 };
  if (database) {
    await database`
      INSERT INTO verity_exams (id, name, duration_seconds)
      VALUES (${exam.id}, ${exam.name}, ${exam.durationSeconds})
    `;
  } else {
    data.exams = [...data.exams.filter((existing) => existing.id !== defaultExam.id), exam];
    writeData(data);
  }
  res.status(201).json(exam);
});

app.get("/api/sessions", async (req, res) => {
  const database = await getDatabase();
  if (database) {
    const sessions = await database`
      SELECT session_id, payload
      FROM verity_sessions
    `;
    return res.json(
      Object.fromEntries(sessions.map(({ session_id, payload }) => [session_id, payload])),
    );
  }
  const data = readData();
  res.json(data.sessions);
});

app.put("/api/sessions/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "Session ID is required." });

  const database = await getDatabase();
  if (database) {
    const updatedAt = Date.now();
    const [session] = await database`
      INSERT INTO verity_sessions (session_id, payload, updated_at)
      VALUES (
        ${id},
        ${JSON.stringify(req.body)}::jsonb || jsonb_build_object(
          'sessionId', ${id},
          'updatedAt', ${updatedAt}
        ),
        ${updatedAt}
      )
      ON CONFLICT (session_id) DO UPDATE SET
        payload = verity_sessions.payload || EXCLUDED.payload,
        updated_at = EXCLUDED.updated_at
      RETURNING payload
    `;
    await database`
      DELETE FROM verity_sessions
      WHERE session_id NOT IN (
        SELECT session_id FROM verity_sessions
        ORDER BY updated_at DESC
        LIMIT 100
      )
    `;
    return res.json(session.payload);
  }

  const data = readData();
  const old = data.sessions[id] || {};
  data.sessions[id] = { ...old, ...req.body, sessionId: id, updatedAt: Date.now() };
  const entries = Object.entries(data.sessions)
    .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
    .slice(0, 100);
  data.sessions = Object.fromEntries(entries);
  writeData(data);
  res.json(data.sessions[id]);
});

app.post("/api/submissions", async (req, res) => {
  const sessionId = String(req.body.sessionId || "").trim();
  if (!sessionId) return res.status(400).json({ error: "Session ID is required." });

  const submission = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    name: String(req.body.name || "").slice(0, 200),
    exam: String(req.body.exam || "").slice(0, 50),
    answers: req.body.answers && typeof req.body.answers === "object" ? req.body.answers : {},
    events: Array.isArray(req.body.events) ? req.body.events.slice(0, 100) : [],
    result: String(req.body.result || "Completed").slice(0, 50),
    submittedAt: new Date().toISOString(),
  };
  const database = await getDatabase();
  if (database) {
    await database`
      INSERT INTO verity_submissions (id, session_id, payload, submitted_at)
      VALUES (
        ${submission.id},
        ${submission.sessionId},
        ${JSON.stringify(submission)}::jsonb,
        ${submission.submittedAt}
      )
    `;
    await database`
      DELETE FROM verity_submissions
      WHERE id NOT IN (
        SELECT id FROM verity_submissions
        ORDER BY submitted_at DESC
        LIMIT 1000
      )
    `;
    return res.status(201).json(submission);
  }

  const data = readData();
  data.submissions = [submission, ...data.submissions].slice(0, 1000);
  writeData(data);
  res.status(201).json(submission);
});

app.use("/api", (error, req, res, next) => {
  console.error("API request failed:", error);
  res.status(error.statusCode || 500).json({
    error: error.message || "The backend request failed.",
  });
});

app.use(express.static(__dirname, { extensions: ["html"] }));

if (require.main === module) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Verity is running at http://localhost:${port}`);
    const addresses = Object.values(os.networkInterfaces())
      .flat()
      .filter((address) => address && address.family === "IPv4" && !address.internal)
      .map((address) => address.address);
    addresses.forEach((address) => {
      console.log(`LAN access: http://${address}:${port}`);
    });
    console.log("Camera access from other devices requires HTTPS.");
  });
}

module.exports = app;
