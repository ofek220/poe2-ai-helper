import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import compression from "compression";
import jwt from "jsonwebtoken";

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
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here"; // Add to .env

// authentication middleware
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Optional: store user data if needed
    next();
  } catch (err) {
    res.status(401).json({ error: "invalid token" });
  }
};

app.get("/api/check", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.json({ loggedIn: false });

  try {
    jwt.verify(token, JWT_SECRET);
    return res.json({ loggedIn: true });
  } catch (err) {
    return res.json({ loggedIn: false });
  }
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

  // generate JWT (expires in 1 day)
  const token = jwt.sign({ authed: true }, JWT_SECRET, { expiresIn: "1d" });
  res.json({ ok: true, token });
});

import messagesRoute from "./src/routes/messages.js";
import generateRoute from "./src/routes/generate.js";
import uploadRouter from "./src/routes/upload.js";
import treeRoute from "./src/routes/treeRoute.js";

app.use("/messages", requireAuth, messagesRoute);
app.use("/api/generate", requireAuth, generateRoute);
app.use("/api/upload", requireAuth, uploadRouter);
app.use("/api/tree", requireAuth, treeRoute);

app.listen(PORT, () => {
  console.log(`🚀Server running on port ${PORT}`);
});
