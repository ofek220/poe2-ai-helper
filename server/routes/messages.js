import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// save chat messages to the database
router.post("/", async (req, res) => {
  try {
    const { sessionId, chatId, role, message, images, classId } = req.body;

    if (role === "system") {
      return res.status(200).json({ success: true, skipped: true });
    }

    const result = await pool.query(
      `INSERT INTO chats (session_id, chat_id, role, message, images, class_id) 
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
      [
        sessionId,
        chatId,
        role,
        message || "",
        JSON.stringify(images || []),
        classId,
      ]
    );
    res.status(200).json({ success: true, chat: result.rows[0] });
  } catch (error) {
    console.error("Error inserting message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// retrieve chat messages for a specific chat
router.get("/:sessionId/:chatId", async (req, res) => {
  try {
    const { sessionId, chatId } = req.params;

    const result = await pool.query(
      `SELECT * FROM chats 
         WHERE session_id = $1 AND chat_id = $2 AND role != 'system'
         ORDER BY created_at ASC`,
      [sessionId, chatId]
    );

    const messages = result.rows.map((row) => ({
      role: row.role,
      text: row.message,
      images:
        typeof row.images === "string" ? JSON.parse(row.images) : row.images,
    }));

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    res.status(500).json({ error: error.message });
  }
});

// get all chat threads for a session
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { classId } = req.query;

    const chatsResult = await pool.query(
      `SELECT chat_id, MAX(created_at) as last_active
         FROM chats 
         WHERE session_id = $1
         AND (class_id = $2 OR ($2 = 'general' AND class_id IS NULL)) 
         AND role != 'system'
         GROUP BY chat_id 
         ORDER BY last_active DESC`,
      [sessionId, classId]
    );

    const chatThreads = await Promise.all(
      chatsResult.rows.map(async (chat) => {
        const messagesResult = await pool.query(
          `SELECT * FROM chats 
           WHERE session_id = $1 AND chat_id = $2 AND role != 'system'
           ORDER BY created_at ASC`,
          [sessionId, chat.chat_id]
        );

        return {
          chat_id: chat.chat_id,
          last_active: chat.last_active,
          messages: messagesResult.rows.map((row) => ({
            role: row.role,
            text: row.message,
            images:
              typeof row.images === "string"
                ? JSON.parse(row.images)
                : row.images,
          })),
        };
      })
    );

    res.status(200).json(chatThreads);
  } catch (error) {
    console.error("Error fetching chat threads:", error);
    res.status(500).json({ error: error.message });
  }
});

// delete a specific chat thread
router.delete("/:sessionId/:chatId", async (req, res) => {
  try {
    const { sessionId, chatId } = req.params;
    await pool.query(
      `DELETE FROM chats 
         WHERE session_id = $1 AND chat_id = $2`,
      [sessionId, chatId]
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// delete all chats for a session
router.delete("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    await pool.query(
      `DELETE FROM chats 
         WHERE session_id = $1`,
      [sessionId]
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting chats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
