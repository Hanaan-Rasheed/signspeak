
import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { Server } from "socket.io";
import { z } from "zod";

import {
  initStore,
  db,
  uid,
  roomCode,
  type Segment,
} from "./store.js";

import {
  makeToken,
  requireAuth,
  verifyToken,
  type Identity,
} from "./auth.js";

// Check the JWT secret before starting the backend.
if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32 ||
  process.env.JWT_SECRET.includes("replace-this")
) {
  throw new Error("Set a secure JWT_SECRET in backend/.env");
}

initStore();

const app = express();
const origin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

app.use(helmet());
app.use(cors({ origin }));
app.use(express.json({ limit: "32kb" }));

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 35,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin },
});

const error = (message: string) => ({ error: message });

// Return user details without exposing password hashes.
function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

// Validate registration and login input.
const signupSchema = z.object({
  name: z.string().trim().min(2).max(70),
  email: z.string().email().max(160).transform(s => s.toLowerCase()),
  password: z.string().min(8).max(100),
  role: z.enum(["teacher", "student"]),
});

const loginSchema = z.object({
  email: z.string().email().transform(s => s.toLowerCase()),
  password: z.string(),
});

// Check whether the API is running.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "SignSpeak API",
  });
});

// Register a new teacher or student.
app.post("/api/auth/register", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(
      error("Check your name, email, password, and role.")
    );
    return;
  }

  const data = parsed.data;

  if (db.users().some(user => user.email === data.email)) {
    res.status(409).json(error("This email is already registered."));
    return;
  }

  const user = {
    id: uid(),
    name: data.name,
    email: data.email,
    role: data.role,
    passwordHash: await bcrypt.hash(data.password, 12),
    createdAt: new Date().toISOString(),
  };

  db.addUser(user);

  res.status(201).json({
    user: publicUser(user),
    token: makeToken({ id: user.id, role: user.role }),
  });
});

// Log in using an existing account.
app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(error("Enter a valid email and password."));
    return;
  }

  const user = db.users().find(
    item => item.email === parsed.data.email
  );

  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json(error("Incorrect email or password."));
    return;
  }

  res.json({
    user: publicUser(user),
    token: makeToken({ id: user.id, role: user.role }),
  });
});

// Get the authenticated user's profile.
app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = db.users().find(
    item => item.id === req.identity!.id
  );

  if (!user) {
    res.status(404).json(error("User not found."));
    return;
  }

  res.json({ user: publicUser(user) });
});

// Get classrooms created by the current teacher.
app.get("/api/rooms", requireAuth, (req, res) => {
  const rooms = db.rooms()
    .filter(room =>
      req.identity!.role === "teacher" &&
      room.teacherId === req.identity!.id
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ rooms });
});

// Create a classroom with a unique room code.
app.post("/api/rooms", requireAuth, (req, res) => {
  if (req.identity!.role !== "teacher") {
    res.status(403).json(error("Only teachers can create rooms."));
    return;
  }

  const parsed = z.object({
    title: z.string().trim().min(3).max(100),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(
      error("Give your classroom a title (3–100 characters).")
    );
    return;
  }

  const room = {
    id: uid(),
    code: roomCode(),
    title: parsed.data.title,
    teacherId: req.identity!.id,
    status: "waiting" as const,
    createdAt: new Date().toISOString(),
  };

  db.addRoom(room);
  res.status(201).json({ room });
});

// Find a classroom using its code.
app.get("/api/rooms/:code", requireAuth, (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const room = db.rooms().find(item => item.code === code);

  if (!room) {
    res.status(404).json(error("Room not found. Check the code."));
    return;
  }

  res.json({ room });
});

// Retrieve saved classroom captions and sign events.
app.get("/api/rooms/:code/transcript", requireAuth, (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const room = db.rooms().find(item => item.code === code);

  if (!room) {
    res.status(404).json(error("Room not found."));
    return;
  }

  const segments = db.segments().filter(
    segment => segment.roomId === room.id
  );

  res.json({ room, segments });
});

// End a classroom without deleting its transcript.
app.post("/api/rooms/:code/end", requireAuth, (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const room = db.rooms().find(item => item.code === code);

  if (!room) {
    res.status(404).json(error("Room not found."));
    return;
  }

  if (room.teacherId !== req.identity!.id) {
    res.status(403).json(
      error("Only the room teacher can end this class.")
    );
    return;
  }

  db.updateRoom(room.id, {
    status: "ended",
    endedAt: new Date().toISOString(),
  });

  io.to(room.code).emit("room:ended");
  res.json({ room });
});

// Authenticate every Socket.io connection.
io.use((socket, next) => {
  try {
    const token = String(socket.handshake.auth.token || "");
    socket.data.identity = verifyToken(token);
    next();
  } catch {
    next(new Error("Authentication required"));
  }
});

const lastInterim = new Map<string, string>();
const signCooldown = new Map<string, number>();

// Count unique students rather than browser tabs.
function sendCount(code: string) {
  const students = new Set<string>();
  const sockets = io.sockets.adapter.rooms.get(code);

  for (const socketId of sockets || []) {
    const member = io.sockets.sockets.get(socketId);

    if (member?.data.identity?.role === "student") {
      students.add(member.data.identity.id);
    }
  }

  io.to(code).emit("room:count", students.size);
}

// Handle classroom communication.
io.on("connection", socket => {
  const identity = socket.data.identity as Identity;

  // Join a classroom and confirm whether the join succeeded.
  socket.on("room:join", (
    rawCode: unknown,
    acknowledge?: (reply: unknown) => void
  ) => {
    const code = String(rawCode || "").trim().toUpperCase();
    const room = db.rooms().find(item => item.code === code);

    if (!room) {
      acknowledge?.({ ok: false, error: "Room not found." });
      return;
    }

    if (
      identity.role === "teacher" &&
      room.teacherId !== identity.id
    ) {
      acknowledge?.({
        ok: false,
        error: "You do not own this classroom.",
      });
      return;
    }

    if (socket.data.code) {
      socket.leave(socket.data.code);
    }

    socket.join(code);
    socket.data.code = code;

    sendCount(code);

    // Send recent caption history to newly joined students.
    const history = db.segments()
      .filter(segment => segment.roomId === room.id)
      .slice(-100);

    socket.emit("room:history", history);

    socket.emit("caption:interim", {
      text: lastInterim.get(code) || "",
    });

    if (room.status === "ended") {
      socket.emit("room:ended");
    }

    acknowledge?.({ ok: true, room });

    console.log(`Socket joined classroom ${code}`);
  });

  // Broadcast temporary speech captions.
  socket.on("caption:interim", (payload: unknown) => {
    const code = socket.data.code as string | undefined;
    const room = db.rooms().find(item => item.code === code);

    if (
      !room ||
      room.status === "ended" ||
      identity.role !== "teacher" ||
      room.teacherId !== identity.id
    ) {
      return;
    }

    const parsed = z.object({
      text: z.string().max(400),
    }).safeParse(payload);

    if (!parsed.success) return;

    lastInterim.set(code!, parsed.data.text);

    socket.to(code!).emit("caption:interim", parsed.data);
  });

  // Save and broadcast finalized speech captions.
  socket.on("caption:final", (payload: unknown) => {
    const code = socket.data.code as string | undefined;
    const room = db.rooms().find(item => item.code === code);

    if (
      !room ||
      room.status === "ended" ||
      identity.role !== "teacher" ||
      room.teacherId !== identity.id
    ) {
      return;
    }

    const parsed = z.object({
      text: z.string().trim().min(1).max(1000),
      id: z.string().uuid(),
    }).safeParse(payload);

    if (!parsed.success) return;

    const alreadySaved = db.segments().some(
      segment => segment.id === parsed.data.id
    );

    if (alreadySaved) return;

    const segment: Segment = {
      id: parsed.data.id,
      roomId: room.id,
      text: parsed.data.text,
      authorId: identity.id,
      kind: "speech",
      createdAt: new Date().toISOString(),
    };

    db.addSegment(segment);

    if (room.status === "waiting") {
      db.updateRoom(room.id, { status: "live" });
    }

    io.to(code!).emit("caption:final", segment);
  });

  // Receive a student's recognized gesture.
  socket.on("sign:detected", (
    payload: unknown,
    acknowledge?: (reply: { ok: boolean; error?: string }) => void
  ) => {
    const reject = (message: string) => {
      acknowledge?.({ ok: false, error: message });
    };

    const code = socket.data.code as string | undefined;

    if (!code) {
      reject("Join a classroom before sending a sign.");
      return;
    }

    const room = db.rooms().find(item => item.code === code);

    if (!room) {
      reject("Classroom not found.");
      return;
    }

    if (room.status === "ended") {
      reject("This classroom has ended.");
      return;
    }

    if (identity.role !== "student") {
      reject("Sign input requires a student account.");
      return;
    }

    // Only the four supported demo labels are accepted.
    const parsed = z.object({
      word: z.enum(["Hello", "Yes", "Question", "Repeat"]),
    }).safeParse(payload);

    if (!parsed.success) {
      reject("This demonstration gesture is not supported.");
      return;
    }

    const now = Date.now();
    const lastSent = signCooldown.get(socket.id) || 0;

    if (now - lastSent < 1800) {
      reject("Please wait before sending another sign.");
      return;
    }

    const segment: Segment = {
      id: uid(),
      roomId: room.id,
      text: parsed.data.word,
      authorId: identity.id,
      kind: "sign",
      createdAt: new Date().toISOString(),
    };

    // Save the sign and send it to everyone in this classroom.
    db.addSegment(segment);
    signCooldown.set(socket.id, now);

    io.to(code).emit("sign:detected", segment);

    // Tell the student that the server accepted the sign.
    acknowledge?.({ ok: true });

    console.log(`Sign received in room ${code}: ${segment.text}`);
  });

  // Update participant counts when a socket disconnects.
  socket.on("disconnecting", () => {
    const code = socket.data.code as string | undefined;

    if (code) {
      setImmediate(() => sendCount(code));
    }
  });

  socket.on("disconnect", () => {
    signCooldown.delete(socket.id);
  });
});

app.use((_req, res) => {
  res.status(404).json(error("Route not found."));
});

const port = Number(process.env.PORT || 4000);

server.listen(port, () => {
  console.log(`SignSpeak API running at http://localhost:${port}`);
});
