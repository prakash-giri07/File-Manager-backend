import express from "express";
import { getAdAccounts } from "../controllers/facebookController.js";

const router = express.Router();

router.post("/ad-accounts", getAdAccounts);

export default router;
