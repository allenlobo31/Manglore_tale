const express = require("express");
const router = express.Router();
const Score = require("../models/Score");

// GET /api/scores - top 10 victories, most recent first
router.get("/", async (req, res) => {
  try {
    const scores = await Score.find({ result: "victory" })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

// POST /api/scores - record a match result
router.post("/", async (req, res) => {
  try {
    const { playerName, result, turns } = req.body;
    if (!playerName || !["victory", "defeat"].includes(result) || typeof turns !== "number") {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const score = await Score.create({ playerName, result, turns });
    res.status(201).json(score);
  } catch (err) {
    res.status(500).json({ error: "Failed to save score" });
  }
});

module.exports = router;