import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import bcrypt from "bcrypt";
import compression from "compression";

const app = express();
// origin: "http://localhost:5173", https://ofek220.github.io

app.use(
  compression({
    level: 6,
    threshold: 0,
    filter: (req, res) => {
      if (res.getHeader("Content-Type")?.includes("json")) return true;
      return compression.filter(req, res);
    },
  }),
);

app.use(
  cors({
    origin: "https://ofek220.github.io",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
      httpOnly: true,
      sameSite: "none",
      secure: true,
    },
  }),
);

// authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authed) return next();
  return res.status(401).json({ error: "unauthorized" });
};

app.get("/api/check", (req, res) => {
  if (req.session && req.session.authed) {
    return res.json({ loggedIn: true });
  }
  return res.json({ loggedIn: false });
});

app.post("/login", async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: "Missing password" });
  }
  const ok = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
  if (!ok) {
    return res.status(401).json({ message: "Password is incorrect" });
  }
  req.session.authed = true;
  res.json({ ok: true });
});

import messagesRoute from "./src/routes/messages.js";
import generateRoute from "./src/routes/generate.js";
import uploadRouter from "./src/routes/upload.js";
import treeRoute from "./src/routes/treeRoute.js";

app.use("/messages", messagesRoute);
app.use("/api/generate", generateRoute);
app.use("/api/upload", uploadRouter);
app.use("/api/tree", treeRoute);

app.listen(PORT, () => {
  console.log(`🚀Server running on port ${PORT}`);
});
