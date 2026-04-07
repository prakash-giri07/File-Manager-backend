import express from "express";
import { upload } from "../middleware/upload.js";
import File from "../models/File.js";
import fs from "fs";

const router = express.Router();

/* ================= UPLOAD FILE ================= */

router.post("/upload", upload.array("files", 200), async (req, res) => {
  try {
    const parentFolder = req.body.parentFolder || null;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const filesData = req.files.map((file) => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      parentFolder,
      isFolder: false,
    }));

    const savedFiles = await File.insertMany(filesData);

    res.status(201).json(savedFiles);
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
});

/* ================= GET FILES ================= */

router.get("/", async (req, res) => {
  try {
    let parentFolder = req.query.parent;

    if (!parentFolder || parentFolder === "null") {
      parentFolder = null;
    }

    const files = await File.find({
      parentFolder: parentFolder,
    }).sort({
      isFolder: -1,
      createdAt: -1,
    });

    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Fetch failed" });
  }
});

/* ================= DELETE ================= */

router.delete("/:id", async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    /* delete folder contents */
    if (file.isFolder) {
      const childFiles = await File.find({ parentFolder: file._id });

      for (const child of childFiles) {
        if (!child.isFolder && fs.existsSync(child.path)) {
          fs.unlinkSync(child.path);
        }

        await child.deleteOne();
      }
    } else {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    await file.deleteOne();

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ message: "Delete failed" });
  }
});

/* ================= RENAME ================= */

router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Filename cannot be empty" });
    }

    const file = await File.findByIdAndUpdate(
      req.params.id,
      { originalname: name.trim() },
      { new: true },
    );

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json(file);
  } catch (error) {
    console.error("RENAME ERROR:", error);
    res.status(500).json({ message: "Rename failed" });
  }
});

/* ================= CREATE FOLDER ================= */

router.post("/folder", async (req, res) => {
  try {
    const { name, parentFolder } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Folder name required" });
    }

    const folder = await File.create({
      originalname: name.trim(),
      filename: null,
      mimetype: "folder",
      size: 0,
      path: null,
      isFolder: true,
      parentFolder: parentFolder || null,
    });

    res.json(folder);
  } catch (error) {
    console.error("FOLDER ERROR:", error);
    res.status(500).json({ message: "Folder creation failed" });
  }
});

export default router;
