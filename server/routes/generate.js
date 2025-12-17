import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import multer from "multer";
import aiPrompt from "../helpers/aiPrompt.js";
import imgPrompt from "../helpers/imgPrompt.js";
import { getOpenAIClient } from "../utils/openai.js";

const router = express.Router();
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX;

const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.array("images", 5), async (req, res) => {
  const openai = getOpenAIClient();
  const { prompt, history } = req.body;
  const userPrompt = prompt;
  const systemPrompt = aiPrompt;
  const imgAnalysis = imgPrompt;
  try {
    let conversationHistory = [];
    if (history) {
      try {
        conversationHistory = JSON.parse(history);
      } catch (error) {
        console.error("Failed to parse history:", error);
        conversationHistory = [];
      }
    } else {
      console.log("No history received in request");
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

          imageAnalysis.push(imageAnalysisResponse.choices[0].message.content);
        } catch (imgError) {
          console.error("❌ Error analyzing image:", imgError.message);
        }
      }
    }

    console.log("📸 Image analysis results:", imageAnalysis);

    let finalPrompt = `User prompt: ${userPrompt}`;
    if (imageAnalysis.length > 0) {
      finalPrompt = `User prompt: ${userPrompt}\n\n[Image Analysis results:${imageAnalysis.join(
        "\n\n"
      )}]`;
    }

    console.log("📝 Final prompt:", finalPrompt);

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      {
        role: "user",
        content: `Context from web:\n${snippets}
        \n\nUser message:\n${finalPrompt}`,
      },
    ];

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: allMessages,
        max_completion_tokens: 2000,
      });

      // token usage logging
      const usage = response.usage;
      console.log("Token usage:", usage);
      console.log(`\u001b[31m Prompt: ${usage.prompt_tokens}\u001b[0m`);
      console.log(`\u001b[32mCompletion: ${usage.completion_tokens}\u001b[0m`);
      console.log(`\u001b[34mTotal: ${usage.total_tokens}\u001b[0m`);

      console.log("✅ OpenAI response received:", response);
      const content = response.choices[0].message.content;

      if (!content) {
        console.error("❌ Returned choice object:", response.choices[0]);
        throw new Error(
          `OpenAI returned empty content for model: ${response.model}`
        );
      }

      console.log("📄 Content extracted:", content);
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
