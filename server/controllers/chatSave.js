import pool from "../config/db";

const saveMessage = async (sessionId, chatId, role, message) => {
  await pool.query(
    `INSERT INTO chats (session_id, chat_id, role, message) VALUES ($1, $2, $3, $4)`,
    [sessionId, chatId, role, message]
  );
};

const getMessages = async (sessionId, chatId) => {
  const result = await pool.query(
    `SELECT * FROM chats WHERE session_id = $1 AND chat_id = $2 ORDER BY created_at ASC`,
    [sessionId, chatId]
  );
  return result.rows;
};

export default { saveMessage, getMessages };
