import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// save chat messages to the database
router.post("/", async (req, res) => {
  try {
    const { sessionId, chatId, role, message, images } = req.body;

    const result = await pool.query(
      `INSERT INTO chats (session_id, chat_id, role, message, images) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
      [sessionId, chatId, role, message, images || "[]"]
    );
    res.status(200).json({ success: true, chat: result.rows[0] });
  } catch (error) {
    console.error("Error inserting message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// retrieve chat messages from the database
router.get("/:sessionId/:chatId", async (req, res) => {
  try {
    const { sessionId, chatId } = req.params;

    const result = await pool.query(
      `SELECT * FROM chats 
         WHERE session_id = $1 AND chat_id = $2 
         ORDER BY created_at ASC`,
      [sessionId, chatId]
    );

    res.status(200).json({ messages: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// get all chat threads for a session
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(
      `SELECT chat_id, MAX(created_at) as last_message_at
         FROM chats 
         WHERE session_id = $1 
         GROUP BY chat_id 
         ORDER BY last_message_at DESC`,
      [sessionId]
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
export default router;
