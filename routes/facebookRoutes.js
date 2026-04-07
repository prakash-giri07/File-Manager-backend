import express from "express";
import { getCampaigns, getKPI } from "../controllers/facebookController.js";

const router = express.Router();
router.get("/health", (req, res) => {
  res.json({
    status: "Facebook API running 🚀",
    timestamp: new Date(),
  });
});

router.get("/campaigns", getCampaigns);
router.get("/kpi", getKPI);

export default router;
