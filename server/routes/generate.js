import express from "express";
import dotenv from "dotenv";
import aiPrompt from "../helpers/aiPrompt.js";
import OpenAI from "openai";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";

dotenv.config();
const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX;

const upload = multer({ dest: "uploads/" });

router.post("/", upload.array("images", 5), async (req, res) => {
  const { prompt } = req.body;
  const userPrompt = prompt;
  const systemPrompt = aiPrompt;

  try {
    if (!req.session) req.session = {};
    if (!req.session.messages) req.session.messages = [];

    const messages = [{ role: "system", content: systemPrompt }];

    // Process images, resize them, and convert to base64
    let imageObjects = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const resizedBuffer = await sharp(file.path)
            .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
            .toBuffer();

          const base64Image = resizedBuffer.toString("base64");
          fs.unlinkSync(file.path);

          imageObjects.push({
            type: "image_url",
            image_url: {
              url: `data:${file.mimetype};base64,${base64Image}`,
            },
          });
        } catch (imgError) {
          fs.unlinkSync(file.path);
        }
      }
    }

    // Get Google search results
    const query = encodeURIComponent(userPrompt);
    const googleSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_CSE_CX}&q=${query}&num=3`;
    const searchResponse = await fetch(googleSearchUrl);
    const searchData = await searchResponse.json();
    const snippets = (searchData.items || [])
      .map(
        (item) =>
          `Title: ${item.title}\nSnippet: ${item.snippet}\nURL: ${item.link}`
      )
      .join("\n\n");

    // testing logs
    console.log("🟢 Encoded Query:", query);
    console.log("🔵 Google Search URL:", googleSearchUrl);
    console.log("🟠 Raw Fetch Response:", searchResponse);
    console.log(
      "🟣 Parsed JSON Response:",
      JSON.stringify(searchData, null, 2)
    );
    console.log("✅ Final Combined Snippets:\n", snippets);
    // end testing logs

    const contentParts = [
      {
        type: "text",
        text:
          `Analyze the image(s) and answer: "${userPrompt}"\n\n` +
          `Context from web:\n${snippets}`,
      },
      ...imageObjects,
    ];

    messages.push({ role: "user", content: contentParts });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;

    // Token usage info
    const usage = response.usage;
    console.log("🟢 Tokens used:");
    console.log("  Prompt:", usage.prompt_tokens);
    console.log("  Completion:", usage.completion_tokens);
    console.log("  Total:", usage.total_tokens);

    req.session.messages.push({ role: "assistant", content });

    res.json({ response: content });
    console.log("✅ Response sent successfully");
    console.log(content);
  } catch (error) {
    console.error("❌ Full error:", error);
    console.error("❌ Error message:", error.message);
    if (error.response) {
      console.error(
        "❌ OpenAI error details:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    res
      .status(500)
      .json({ error: "Internal server error, Failed to generate a response" });
  }
});

export default router;
