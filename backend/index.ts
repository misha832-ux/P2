import express, { Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Loaded" : "NOT loaded");

// Connection pool — cap at 10 connections, well within MongoDB Atlas free tier (100 limit)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "?maxPoolSize=10&minPoolSize=2",
    },
  },
});

const app = express();

// Rate limiting — max 30 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
app.use("/api/", (req, res, next) => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const window = 60 * 1000;
  const max = 30;
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + window });
    return next();
  }
  if (entry.count >= max) {
    return res.status(429).json({ error: "Too many requests, please slow down." });
  }
  entry.count++;
  next();
});

app.use(cors());

// Body size cap
app.use(express.json({ limit: "50kb" }));

// Request timeout middleware — responds with 503 if a handler takes more than 9 seconds.
// The frontend aborts at 10 s; this fires just before so the response body is meaningful.
app.use((_req: Request, res: Response, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Request timed out. Please try again." });
    }
  }, 9000);
  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  next();
});

app.use((req, _res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  next();
});

// Health check
app.get("/api/test", (_req: Request, res: Response) => {
  res.json({ message: "✅ Backend connected to MongoDB via Prisma!" });
});

// POST /api/user
app.post("/api/user", async (req: Request, res: Response) => {
  try {
    const { userId, name, age, gender, profession } = req.body;

    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({ error: "userId is required" });
    }
    if (!age || isNaN(Number(age))) {
      return res.status(400).json({ error: "age is required" });
    }
    if (!gender || typeof gender !== "string") {
      return res.status(400).json({ error: "gender is required" });
    }
    if (!profession || typeof profession !== "string") {
      return res.status(400).json({ error: "profession is required" });
    }

    const data = {
      age: Number(age),
      gender: String(gender).trim(),
      profession: String(profession).trim(),
      ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
    };

    // Use findUnique (userId has @unique) — much faster than findFirst (no full scan)
    const existing = await prisma.user.findUnique({ where: { userId: userId.trim() } });
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data })
      : await prisma.user.create({ data: { userId: userId.trim(), ...data } });

    console.log("✅ User upserted:", user.userId);
    res.json({ ok: true, user });
  } catch (error) {
    console.error("❌ User upsert failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to save user" });
  }
});

// POST /api/ai-text
app.post("/api/ai-text", async (req: Request, res: Response) => {
  try {
    const { prompt, text, userId } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" });
    }
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing text" });
    }

    // findUnique instead of findFirst — uses the @unique index, avoids full collection scan
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const aiEntry = await prisma.aiEntry.create({
      data: {
        prompt: typeof prompt === "string" ? prompt : "",
        text,
        userId,
        userRef: user.id,
      },
    });

    console.log("✅ AI entry saved:", aiEntry.id);
    res.json({ ok: true, aiEntry });
  } catch (error) {
    console.error("❌ AI entry failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to save AI entry" });
  }
});

// POST /api/manual-text
app.post("/api/manual-text", async (req: Request, res: Response) => {
  try {
    const { text, userId } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" });
    }
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing text" });
    }

    // findUnique instead of findFirst — uses the @unique index, avoids full collection scan
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const manualEntry = await prisma.manualEntry.create({
      data: { text, userId, userRef: user.id },
    });

    console.log("✅ Manual entry saved:", manualEntry.id);
    res.json({ ok: true, manualEntry });
  } catch (error) {
    console.error("❌ Manual entry failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to save manual entry" });
  }
});

// GET /api/session — admin inspection route
app.get("/api/session", async (_req: Request, res: Response) => {
  try {
    const [users, aiEntries, manualEntries] = await Promise.all([
      prisma.user.findMany(),
      prisma.aiEntry.findMany({ include: { user: true } }),
      prisma.manualEntry.findMany({ include: { user: true } }),
    ]);
    res.json({ users, aiEntries, manualEntries });
  } catch (error) {
    console.error("❌ Session fetch failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to fetch session" });
  }
});

// POST /api/backfill-entries — one-off admin utility
app.post("/api/backfill-entries", async (_req: Request, res: Response) => {
  try {
    const [allAi, allManual, users] = await Promise.all([
      prisma.aiEntry.findMany({ select: { id: true, userId: true, createdAt: true, userRef: true } }),
      prisma.manualEntry.findMany({ select: { id: true, userId: true, createdAt: true, userRef: true } }),
      prisma.user.findMany({ select: { id: true, userId: true, createdAt: true } }),
    ]);

    type UserRecord = { id: string; userId: string; createdAt: Date };
    const userMap = new Map<string, UserRecord>(users.map((u: UserRecord) => [u.userId, u]));

    const updatedAi: object[] = [];
    for (const e of allAi) {
      if (e.userRef) continue;
      const user: UserRecord | undefined = e.userId ? (userMap.get(e.userId) ?? undefined) : (findClosest(users, e.createdAt) ?? undefined);
      if (user) {
        const u = await prisma.aiEntry.update({ where: { id: e.id }, data: { userRef: user.id, userId: user.userId } });
        updatedAi.push(u);
      }
    }

    const updatedManual: object[] = [];
    for (const e of allManual) {
      if (e.userRef) continue;
      const user: UserRecord | undefined = e.userId ? (userMap.get(e.userId) ?? undefined) : (findClosest(users, e.createdAt) ?? undefined);
      if (user) {
        const u = await prisma.manualEntry.update({ where: { id: e.id }, data: { userRef: user.id, userId: user.userId } });
        updatedManual.push(u);
      }
    }

    res.json({ updatedAi, updatedManual });
  } catch (error) {
    console.error("❌ Backfill failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "Backfill failed" });
  }
});

function findClosest(users: { id: string; userId: string; createdAt: Date }[], createdAt: Date | null) {
  if (!createdAt) return null;
  let best: (typeof users)[0] | null = null;
  let bestDiff = Number.MAX_SAFE_INTEGER;
  for (const u of users) {
    const diff = Math.abs(new Date(createdAt).getTime() - new Date(u.createdAt).getTime());
    if (diff < bestDiff) { bestDiff = diff; best = u; }
  }
  return best && bestDiff <= 120_000 ? best : null;
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });