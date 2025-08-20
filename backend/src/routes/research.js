const express = require("express");
const {
  startResearch,
  getResearchStatus,
  getResearchResults,
} = require("../controllers/researchController");

const router = express.Router();

/**
 * @route   POST /api/research
 * @desc    Start a new research job
 * @access  Public
 */
router.post("/", startResearch);

/**
 * @route   GET /api/research/status/:jobId
 * @desc    Get status of a research job
 * @access  Public
 */
router.get("/status/:jobId", getResearchStatus);

/**
 * @route   GET /api/research/results/:jobId
 * @desc    Get results of a completed research job
 * @access  Public
 */
router.get("/results/:jobId", getResearchResults);

module.exports = router;
