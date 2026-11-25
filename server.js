const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = Number(process.env.PORT) || 3000;
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "backend.json");

fs.mkdirSync(dataDir, { recursive: true });

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
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
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

app.get("/api/exams", (req, res) => {
  const data = readData();
  res.json([defaultExam, ...data.exams.filter((exam) => exam.id !== defaultExam.id)]);
});

app.post("/api/exams", (req, res) => {
  const name = String(req.body.name || "").trim();
  const minutes = Number(req.body.minutes);
  if (!name || !Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    return res.status(400).json({ error: "A test name and duration from 1 to 240 minutes are required." });
  }

  const data = readData();
  const exams = [defaultExam, ...data.exams.filter((exam) => exam.id !== defaultExam.id)];
  let id;
  do {
    id = `EX-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  } while (exams.some((exam) => exam.id === id));

  const exam = { id, name, durationSeconds: minutes * 60 };
  data.exams = [...data.exams.filter((existing) => existing.id !== defaultExam.id), exam];
  writeData(data);
  res.status(201).json(exam);
});

app.get("/api/sessions", (req, res) => {
  const data = readData();
  res.json(data.sessions);
});

app.put("/api/sessions/:id", (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "Session ID is required." });

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

app.post("/api/submissions", (req, res) => {
  const sessionId = String(req.body.sessionId || "").trim();
  if (!sessionId) return res.status(400).json({ error: "Session ID is required." });

  const data = readData();
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
  data.submissions = [submission, ...data.submissions].slice(0, 1000);
  writeData(data);
  res.status(201).json(submission);
});

app.use(express.static(__dirname, { extensions: ["html"] }));

app.listen(port, () => {
  console.log(`Verity is running at http://localhost:${port}`);
});
