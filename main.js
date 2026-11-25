// Shared helpers used by every page.
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString("en-GB");
const ST = {
  Monitoring: ["ok", "● Monitoring"],
  Alert: ["warn", "▲ Alert"],
  Offline: ["bad", "✕ Offline"],
};
const SEV = {
  LOW: ["off", "● Low"],
  MEDIUM: ["warn", "▲ Medium"],
  HIGH: ["bad", "■ High"],
};
const badge = (t, txt) => `<span class="badge ${t}">${txt}</span>`;
const sevBadge = (s) => badge(...SEV[s]);
const tone = (s) =>
  s >= 90
    ? { c: "ok", label: "Strong sample" }
    : s >= 75
      ? { c: "warn", label: "Review sample" }
      : { c: "bad", label: "Weak sample" };
const examCatalog = (() => {
  const key = "verity-exam-catalog-v1";
  function read() {
    let stored = [];
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(value))
        stored = value.filter(
          (exam) =>
            exam &&
            typeof exam.id === "string" &&
            typeof exam.name === "string" &&
            Number.isInteger(exam.durationSeconds) &&
            exam.durationSeconds > 0,
        );
    } catch (error) {
      toast(`Tests could not be loaded: ${error.message}`, "bad");
    }
    return stored.filter(
      (exam) =>
        exam.id.toUpperCase() !== "EX-2026" &&
        Array.isArray(exam.questions) &&
        exam.questions.length > 0 &&
        Array.isArray(exam.assignments) &&
        exam.assignments.length > 0,
    );
  }
  function find(id) {
    return (
      read().find(
        (exam) =>
          exam.id.toUpperCase() ===
          String(id || "")
            .trim()
            .toUpperCase(),
      ) || null
    );
  }
  function create(name, minutes, questions, candidateNames) {
    const exams = read(),
      normalizedName = String(name || "").trim(),
      durationSeconds = Math.round(Number(minutes) * 60),
      validQuestions =
        Array.isArray(questions) &&
        questions.length > 0 &&
        questions.length <= 50 &&
        questions.every(
          (question) =>
            question &&
            typeof question.q === "string" &&
            question.q.trim() &&
            Array.isArray(question.o) &&
            question.o.length >= 2 &&
            question.o.every(
              (option) => typeof option === "string" && option.trim(),
            ) &&
            Number.isInteger(question.answer) &&
            question.answer >= 0 &&
            question.answer < question.o.length,
        ),
      names = Array.isArray(candidateNames)
        ? candidateNames
            .map((candidate) => String(candidate || "").trim())
            .filter(Boolean)
        : [],
      uniqueNames = new Set(names.map((candidate) => candidate.toLocaleLowerCase()));
    if (
      !normalizedName ||
      !Number.isInteger(durationSeconds) ||
      durationSeconds < 60 ||
      durationSeconds > 4 * 60 * 60 ||
      !validQuestions ||
      !names.length ||
      names.length !== uniqueNames.size ||
      names.some((candidate) => candidate.length > 100)
    )
      return null;
    let id;
    do {
      id = `EX-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    } while (exams.some((exam) => exam.id === id));
    const assignments = names.map((candidate) => ({
      name: candidate,
      accessCode: Array.from(
        { length: 8 },
        () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)],
      ).join(""),
    }));
    const exam = {
      id,
      name: normalizedName,
      durationSeconds,
      questions: questions.map((question) => ({
        q: question.q.trim(),
        o: question.o.map((option) => option.trim()),
        answer: question.answer,
      })),
      assignments,
    };
    try {
      localStorage.setItem(
        key,
        JSON.stringify([
          ...exams,
          exam,
        ]),
      );
      return exam;
    } catch (error) {
      toast(`Test could not be saved: ${error.message}`, "bad");
      return null;
    }
  }
  function authorize(id, candidateName, accessCode) {
    const exam = find(id);
    if (!exam || !Array.isArray(exam.assignments)) return false;
    return (
      Array.isArray(exam.assignments) &&
      exam.assignments.some(
        (assignment) =>
          assignment.name.toLocaleLowerCase() ===
            String(candidateName || "").trim().toLocaleLowerCase() &&
          assignment.accessCode === String(accessCode || "").trim().toUpperCase(),
      )
    );
  }
  return { read, find, create, authorize };
})();
function ring(s, size = 72, label = "Sample score", color = tone(s).c) {
  const score = Math.max(0, Math.min(100, Math.round(Number(s) || 0))),
    r = 28,
    c = 2 * Math.PI * r;
  return `<div class="ringw" style="width:${size}px;height:${size}px" role="img" aria-label="${escapeHTML(label)} ${score} percent"><svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--${color})" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * score) / 100} ${c}" transform="rotate(-90 32 32)"/></svg><span class="ringn" style="font-size:${size / 4}px">${score}</span></div>`;
}
function timelineHTML(list) {
  return `<ol class="rail">${list
    .map((event) => {
      const [t, l, s] = Array.isArray(event)
        ? event
        : [event.at, event.label, event.severity];
      return `<li class="s-${SEV[s] ? s : "LOW"}"><time class="mono mut text-sm">${escapeHTML(t)}</time> <span class="font-bold">${escapeHTML(l)}</span> ${SEV[s] ? sevBadge(s) : badge("off", "Unrated")}</li>`;
    })
    .join("")}</ol>`;
}
function toast(msg, t = "ok") {
  let b = $("#toasts");
  if (!b) {
    b = document.createElement("div");
    b.id = "toasts";
    b.setAttribute("role", "status");
    document.body.append(b);
  }
  const e = document.createElement("div");
  e.className = "toast " + t;
  e.textContent = msg;
  b.append(e);
  setTimeout(() => e.remove(), 4500);
}
// Theme + generic toggles
try {
  if (localStorage.getItem("theme") === "dark")
    document.documentElement.classList.add("dark");
} catch {}
function syncThemeButtons() {
  const dark = document.documentElement.classList.contains("dark");
  $$("[data-theme-toggle]").forEach((b) =>
    b.setAttribute("aria-pressed", dark),
  );
}
syncThemeButtons();
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-theme-toggle]");
  if (t) {
    const d = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", d ? "dark" : "light");
    } catch {}
    syncThemeButtons();
  }
  const m = e.target.closest("[data-toggle]");
  if (m) {
    const el = document.getElementById(m.dataset.toggle);
    el.classList.toggle("hidden");
    m.setAttribute("aria-expanded", !el.classList.contains("hidden"));
  }
  if (e.target.closest("#menu a")) {
    $("#menu").classList.add("hidden");
    $('[data-toggle="menu"]')?.setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const menu = $("#menu");
    if (menu && !menu.classList.contains("hidden")) {
      menu.classList.add("hidden");
      $('[data-toggle="menu"]')?.setAttribute("aria-expanded", "false");
    }
  }
});

// Same-origin tabs can share live exam status without uploading candidate video.
const liveSessions = (() => {
  const key = "verity-live-sessions-v1",
    channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(key),
    listeners = new Set();
  let syncTimer = null,
    syncInFlight = false,
    backendWarningShown = false,
    localMutationVersion = 0;
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    } catch (error) {
      toast(`Live sessions could not be read: ${error.message}`, "bad");
      return {};
    }
  }
  function notify() {
    const sessions = read();
    listeners.forEach((listener) => listener(sessions));
  }
  function showBackendWarning(error) {
    if (backendWarningShown) return;
    backendWarningShown = true;
    toast(`Backend sync failed: ${error.message}`, "bad");
  }
  async function syncFromServer() {
    if (syncInFlight) return;
    syncInFlight = true;
    const requestVersion = localMutationVersion;
    try {
      const response = await fetch("/api/sessions");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const remote = await response.json();
      if (!remote || typeof remote !== "object" || Array.isArray(remote))
        throw new Error("The server returned invalid session data.");
      if (requestVersion !== localMutationVersion) return;
      const local = read(),
        merged = { ...local, ...remote };
      if (JSON.stringify(local) !== JSON.stringify(merged)) {
        localStorage.setItem(key, JSON.stringify(merged));
        channel?.postMessage("updated");
        listeners.forEach((listener) => listener(merged));
      }
      backendWarningShown = false;
    } catch (error) {
      showBackendWarning(error);
    } finally {
      syncInFlight = false;
    }
  }
  async function saveToServer(id, patch) {
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      backendWarningShown = false;
    } catch (error) {
      showBackendWarning(error);
    }
  }
  function update(id, patch) {
    try {
      const sessions = read(),
        old = sessions[id] || {};
      localMutationVersion++;
      sessions[id] = { ...old, ...patch, sessionId: id, updatedAt: Date.now() };
      const entries = Object.entries(sessions)
        .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
        .slice(0, 100);
      localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
      channel?.postMessage("updated");
      notify();
      void saveToServer(id, patch);
      return sessions[id];
    } catch (error) {
      toast(`Live session could not be shared: ${error.message}`, "bad");
      return null;
    }
  }
  function subscribe(listener) {
    listeners.add(listener);
    listener(read());
    if (!syncTimer) {
      void syncFromServer();
      syncTimer = setInterval(syncFromServer, 1000);
    }
    const onStorage = (event) => {
      if (event.key === key) listener(read());
    };
    const onMessage = () => listener(read());
    addEventListener("storage", onStorage);
    channel?.addEventListener("message", onMessage);
    return () => {
      listeners.delete(listener);
      if (!listeners.size && syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
      removeEventListener("storage", onStorage);
      channel?.removeEventListener("message", onMessage);
    };
  }
  return { read, update, subscribe };
})();

async function getRtcConfiguration() {
  let response;
  try {
    response = await fetch("/api/rtc-config");
  } catch (error) {
    throw new Error(
      `Could not reach the RTC configuration endpoint. Open this app from the running backend URL. ${error.message}`,
    );
  }
  let configuration;
  try {
    configuration = await response.json();
  } catch (error) {
    throw new Error(
      `The RTC configuration endpoint returned invalid JSON (HTTP ${response.status}). ${error.message}`,
    );
  }
  if (!response.ok)
    throw new Error(
      configuration.error ||
        `RTC configuration unavailable (HTTP ${response.status})`,
    );
  if (!Array.isArray(configuration.iceServers))
    throw new Error("The server returned invalid RTC configuration.");
  return { iceServers: configuration.iceServers };
}
function eventData(event, index) {
  if (Array.isArray(event))
    return {
      id: `legacy-${index}`,
      at: event[0],
      label: event[1],
      severity: event[2],
      reviewStatus: "Open",
      note: "",
    };
  return {
    id: String(event.id || `legacy-${index}`),
    at: String(event.at || ""),
    label: String(event.label || ""),
    severity: SEV[event.severity] ? event.severity : "LOW",
    reviewStatus: ["Open", "Reviewed", "Dismissed as false positive"].includes(
      event.reviewStatus,
    )
      ? event.reviewStatus
      : "Open",
    note: String(event.note || ""),
  };
}
function eventList(session) {
  return (Array.isArray(session.events) ? session.events : []).map(eventData);
}
function monitoringScore(events) {
  const deductions = { LOW: 3, MEDIUM: 10, HIGH: 25 };
  return Math.max(
    0,
    100 -
      events.reduce(
        (total, event) =>
          total +
          (event.reviewStatus === "Dismissed as false positive"
            ? 0
            : deductions[event.severity] || 0),
        0,
      ),
  );
}
function getLiveCandidates() {
  const cutoff = Date.now() - 8 * 60 * 60 * 1000;
  return Object.values(liveSessions.read())
    .filter(
      (candidate) =>
        candidate &&
        typeof candidate.sessionId === "string" &&
        typeof candidate.name === "string" &&
        typeof candidate.updatedAt === "number" &&
        candidate.updatedAt > cutoff,
    )
    .map((candidate) => {
      const events = eventList(candidate),
        connected = Date.now() - candidate.updatedAt < 20000;
      const status = ["Completed", "Disqualified", "Left"].includes(
        candidate.status,
      )
        ? candidate.status
        : !connected && candidate.status === "In exam"
          ? "Left"
          : !connected || candidate.status === "Disconnected"
            ? "Offline"
            : candidate.status === "Readiness"
              ? "Readiness"
              : events.some(
                    (event) =>
                      event.severity === "HIGH" &&
                      event.reviewStatus === "Open",
                  )
                ? "Alert"
                : "Monitoring";
      return {
        ...candidate,
        connected,
        sessionStatus: candidate.status,
        events,
        status,
        conn: candidate.connection || "Checking",
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
