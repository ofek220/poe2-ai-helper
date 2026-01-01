-- Schema for storing chat messages
CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  message TEXT,
  images JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  class varchar NOT NULL
);
