import OpenAI from "openai";

export const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in environment");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};
