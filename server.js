import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import fileRoutes from "./routes/fileRoutes.js";
import facebookRoutes from "./routes/facebookRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/files", fileRoutes);
app.use("/api/facebook", facebookRoutes);

app.get("/", (req, res) => {
  res.send("🚀 Server is running...");
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ Mongo Error:", err.message);
    process.exit(1);
  });

app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.message);
  res.status(500).json({
    message: "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
