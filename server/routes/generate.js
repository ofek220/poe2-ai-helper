import express, { text } from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import multer from "multer";
import aiPrompt from "../helpers/aiPrompt.js";
import imgPrompt from "../helpers/imgPrompt.js";

dotenv.config();
const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX;

const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.array("images", 5), async (req, res) => {
  const { prompt } = req.body;
  const userPrompt = prompt;
  const systemPrompt = aiPrompt;
  const imgAnalysis = imgPrompt;
  try {
    if (!req.session) req.session = {};
    if (!req.session.messages) req.session.messages = [];

    const messages = [{ role: "system", content: systemPrompt }];

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
    // console.log(
    //   "🟣 Parsed JSON Response:",
    //   JSON.stringify(searchData, null, 2)
    // );
    console.log("✅ Final Combined Snippets:\n", snippets);
    console.log("🟣Uploaded files:", req.files);

    // end testing logs

    const imageUrls = req.body.imageUrls
      ? Array.isArray(req.body.imageUrls)
        ? req.body.imageUrls
        : [req.body.imageUrls]
      : [];

    let imageAnalysis = [];
    if (imageUrls.length > 0) {
      for (const url of imageUrls) {
        try {
          const imageResponse = await fetch(url);
          const arrayBuffer = await imageResponse.arrayBuffer();
          const imageBuffer = Buffer.from(arrayBuffer);
          const base64Image = imageBuffer.toString("base64");
          const mimetype = imageResponse.headers.get("content-type");
          const imageUrl = `data:${mimetype};base64,${base64Image}`;

          const imageAnalysisResponse = await openai.chat.completions.create({
            model: "gpt-4.1-mini-2025-04-14",
            messages: [
              {
                role: "system",
                content: imgAnalysis,
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze the attached image and provide a summary based on the current build planner system instructions.",
                  },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
            max_completion_tokens: 500,
          });

          // token usage
          const imageUsage = imageAnalysisResponse.usage;
          console.log(`Prompt: ${imageUsage.prompt_tokens}`);
          console.log(`Completion: ${imageUsage.completion_tokens}`);
          console.log(`Total: ${imageUsage.total_tokens}`);
          //
          imageAnalysis.push(imageAnalysisResponse.choices[0].message.content);
        } catch (imgError) {
          console.error("❌ Error analyzing image:", imgError.message);
        }
      }
    }

    console.log("📸 Image analysis results:", imageAnalysis);

    const finalPrompt = `
      Image analysis results:${imageAnalysis.join("\n\n")}
      User prompt: ${userPrompt}
      Context from web:${snippets}`;

    console.log("📝 Final prompt:", finalPrompt);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini-2025-08-07",
        messages: [
          {
            role: "system",
            content:
              "Combine the following image analysis and text context into a comprehensive answer.",
          },
          { role: "user", content: finalPrompt },
        ],
        max_completion_tokens: 2000,
      });

      console.log("✅ OpenAI response received:", response);
      const content = response.choices[0].message.content;
      console.log("📄 Content extracted:", content);

      if (!content) {
        console.error("❌ Returned choice object:", response.choices[0]);
        throw new Error(
          `OpenAI returned empty content for model: ${response.model}`
        );
      }

      req.session.messages.push({ role: "assistant", content });

      console.log("✅ Response sent successfully");
      return res.json({ response: content });
    } catch (openaiError) {
      console.error("❌ OpenAI API call failed:", openaiError);
      console.error(
        "❌ Error details:",
        openaiError.response?.data || openaiError.message
      );
      throw openaiError;
    }
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
