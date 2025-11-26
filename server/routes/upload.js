import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { error } from "console";
import { url } from "inspector";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
});

router.post("/", upload.array("images", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const imageUrls = req.files.map((file) => {
      return `http://localhost:3000/uploads/${file.filename}`;
    });

    res.json({ imageUrls });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload images" });
  }
});

router.delete("/", async (req, res) => {
  try {
    const { imageUrls } = req.body;
    if (!imageUrls || !Array.isArray(imageUrls)) {
      return res.status(400).json({ error: "Invalid imageUrls" });
    }

    const deletedFiles = [];
    const failedFiles = [];
    try {
      for (const url of imageUrls) {
        const filename = url.split("/uploads/")[1];
        if (!filename) {
          failedFiles.push(url);
          continue;
        }
      }

      const filePath = path.join(process.cwd(), "uploads", filename);

      if (js.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedFiles.push(filePath);
        console.log(`🗑️ Deleted: ${filename}`);
      } else {
        failedFiles.push(url);
        console.log(`file not found: ${filePath}`);
      }
    } catch (error) {
      failedFiles.push(url);
      console.error(`❌ Error deleting file:`, error);
    }

    res.json({ success: true, deletedFiles, failedFiles });
  } catch (error) {
    console.error("Error deleting file:", error);
  }
});
export default router;
