import { get, put } from "@vercel/blob";

const PATH = "leaderboard/top-three.json";
const EMPTY = { records: [], recentSubmissions: [] };
const MAX_SUBMISSIONS_PER_INSTANCE = 12;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff"
    }
  });
}

async function readBoard() {
  const blob = await get(PATH, { access: "private", useCache: false });
  if (!blob) return { board: { ...EMPTY }, etag: null };
  if (!blob.stream) return { board: { ...EMPTY }, etag: blob.blob.etag };
  const parsed = JSON.parse(await new Response(blob.stream).text());
  const board = {
    records: Array.isArray(parsed.records) ? parsed.records.slice(0, 3) : [],
    recentSubmissions: Array.isArray(parsed.recentSubmissions) ? parsed.recentSubmissions.slice(-100) : []
  };
  return { board, etag: blob.blob.etag };
}

function rankRecords(records) {
  return records.sort((a, b) => b.points - a.points || b.accuracy - a.accuracy || a.createdAt.localeCompare(b.createdAt));
}

function validName(name) {
  return typeof name === "string" && /^[\p{L}\p{N} .’'-]{2,20}$/u.test(name.trim());
}

function rateLimited(request) {
  const now = Date.now();
  for (const [ip, entry] of attempts) if (now - entry.start > WINDOW_MS) attempts.delete(ip);
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  const ip = forwarded.split(",")[0].trim();
  const entry = attempts.get(ip) || { start: now, count: 0 };
  entry.count++;
  attempts.set(ip, entry);
  return entry.count > MAX_SUBMISSIONS_PER_INSTANCE;
}

export async function GET() {
  try {
    const { board } = await readBoard();
    return json({ records: rankRecords(board.records) });
  } catch {
    return json({ error: "Leaderboard is temporarily unavailable." }, 503);
  }
}

export async function POST(request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).origin !== new URL(request.url).origin) {
      return json({ error: "Requests must come from the game site." }, 403);
    }
    if (rateLimited(request)) return json({ error: "Too many saves. Please wait a few minutes and try again." }, 429);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 2048) return json({ error: "That score submission is too large." }, 413);
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const points = Number(body.points);
    const accuracy = Number(body.accuracy);
    const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";

    if (!validName(name)) return json({ error: "Use a 2–20 character name or nickname." }, 400);
    if (!Number.isSafeInteger(points) || points < 1 || points > 1000000) return json({ error: "Score must be between 1 and 1,000,000 points." }, 400);
    if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) return json({ error: "Accuracy must be between 0% and 100%." }, 400);
    if (!/^[a-f0-9-]{36}$/i.test(submissionId)) return json({ error: "The save request is invalid. Please try again." }, 400);

    for (let attempt = 0; attempt < 6; attempt++) {
      const { board, etag } = await readBoard();
      if (board.recentSubmissions.includes(submissionId)) return json({ duplicate: true, records: board.records });

      const previousLeader = rankRecords(board.records.slice())[0];
      const createdAt = new Date().toISOString();
      const record = { id: crypto.randomUUID(), name, points, accuracy: Math.round(accuracy * 10) / 10, createdAt };
      const records = rankRecords([...board.records, record]).slice(0, 3);
      const next = { records, recentSubmissions: [...board.recentSubmissions, submissionId].slice(-100) };
      try {
        await put(PATH, JSON.stringify(next), {
          access: "private",
          allowOverwrite: Boolean(etag),
          contentType: "application/json",
          ...(etag ? { ifMatch: etag } : {})
        });
        return json({ record, records, savedToBoard: records.some(entry => entry.id === record.id), newHighScore: points > (previousLeader?.points || 0) });
      } catch (error) {
        if (attempt === 5) throw error;
      }
    }
    return json({ error: "Could not save that score. Please try again." }, 503);
  } catch {
    return json({ error: "Could not save that score right now. Please try again." }, 503);
  }
}

