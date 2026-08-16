const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema({
  playerName: { type: String, required: true, maxlength: 20 },
  result: { type: String, enum: ["victory", "defeat"], required: true },
  turns: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Score", scoreSchema);