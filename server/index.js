import express from "express";
import cors from "cors";
import session from "express-session";
import bcrypt from "bcrypt";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    },
  })
);

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

import generateRoute from "./routes/generate.js";
app.use("/api/generate", generateRoute);

app.listen(PORT, () => {
  console.log(`🚀Server running on port ${PORT}`);
});
