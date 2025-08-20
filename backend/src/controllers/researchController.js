const { v4: uuidv4 } = require("uuid");
const { Queue } = require("bull");
const geminiService = require("../services/geminiService");
const scholarScraperService = require("../services/scholarScraperService");
const pdfProcessorService = require("../services/pdfProcessorService");

// In-memory storage for job status and results
// In a production app, this would be a database
const jobs = new Map();
const results = new Map();

// Create a Bull queue for processing research jobs
const researchQueue = new Queue("research-queue", {
  // In a production app, you would use Redis
  // For local development, we use the default in-memory implementation
});

/**
 * Start a new research job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const startResearch = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res
        .status(400)
        .json({ error: true, message: "Query is required" });
    }

    // Generate a unique job ID
    const jobId = uuidv4();

    // Store initial job status
    jobs.set(jobId, {
      id: jobId,
      status: "queued",
      progress: 0,
      createdAt: new Date(),
      query,
    });

    // Add job to queue
    await researchQueue.add("process-research", {
      jobId,
      query,
    });

    res.status(202).json({
      jobId,
      status: "queued",
      message: "Research job has been queued",
    });
  } catch (error) {
    console.error("Error starting research job:", error);
    res.status(500).json({
      error: true,
      message: "Failed to start research job",
    });
  }
};

/**
 * Get the status of a research job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getResearchStatus = (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobs.has(jobId)) {
      return res.status(404).json({
        error: true,
        message: "Job not found",
      });
    }

    const job = jobs.get(jobId);

    res.status(200).json({
      jobId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt || job.createdAt,
    });
  } catch (error) {
    console.error("Error getting job status:", error);
    res.status(500).json({
      error: true,
      message: "Failed to get job status",
    });
  }
};

/**
 * Get the results of a completed research job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getResearchResults = (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobs.has(jobId)) {
      return res.status(404).json({
        error: true,
        message: "Job not found",
      });
    }

    const job = jobs.get(jobId);

    if (job.status !== "completed") {
      return res.status(400).json({
        error: true,
        message: `Job is not completed yet. Current status: ${job.status}`,
      });
    }

    if (!results.has(jobId)) {
      return res.status(404).json({
        error: true,
        message: "Results not found",
      });
    }

    const result = results.get(jobId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting job results:", error);
    res.status(500).json({
      error: true,
      message: "Failed to get job results",
    });
  }
};

// Process research jobs in the queue
researchQueue.process("process-research", async (job) => {
  const { jobId, query } = job.data;

  try {
    // Update job status
    updateJobStatus(
      jobId,
      "processing",
      10,
      "Expanding research query with Gemini"
    );

    // Step 1: Expand query into relevant topics using Gemini
    const expandedTopics = await geminiService.expandQuery(query);

    updateJobStatus(
      jobId,
      "processing",
      20,
      "Searching Google Scholar for relevant papers"
    );

    // Step 2: Scrape Google Scholar for each topic
    const papersByTopic = {};
    let overallProgress = 20;
    const progressPerTopic = 50 / expandedTopics.length;

    for (let i = 0; i < expandedTopics.length; i++) {
      const topic = expandedTopics[i];
      updateJobStatus(
        jobId,
        "processing",
        Math.floor(overallProgress + i * progressPerTopic),
        `Searching for papers on: ${topic}`
      );

      const papers = await scholarScraperService.searchScholar(topic);
      papersByTopic[topic] = papers;
    }

    updateJobStatus(
      jobId,
      "processing",
      70,
      "Downloading and processing papers"
    );

    // Step 3: Process papers (download PDFs, extract text)
    const processedPapers = await pdfProcessorService.processPapers(
      papersByTopic
    );

    updateJobStatus(
      jobId,
      "processing",
      90,
      "Generating research analysis with Gemini"
    );

    // Step 4: Generate research analysis with Gemini
    const researchAnalysis = await geminiService.generateResearchAnalysis(
      query,
      processedPapers
    );

    // Store results
    results.set(jobId, {
      query,
      expandedTopics,
      papersByTopic: processedPapers,
      analysis: researchAnalysis,
    });

    // Mark job as completed
    updateJobStatus(jobId, "completed", 100, "Research analysis completed");

    return { success: true };
  } catch (error) {
    console.error(`Error processing research job ${jobId}:`, error);
    updateJobStatus(jobId, "failed", 0, `Error: ${error.message}`);
    throw error;
  }
});

/**
 * Update the status of a job
 * @param {string} jobId - The job ID
 * @param {string} status - The new status
 * @param {number} progress - The progress percentage (0-100)
 * @param {string} message - Status message
 */
function updateJobStatus(jobId, status, progress, message) {
  if (jobs.has(jobId)) {
    const job = jobs.get(jobId);
    jobs.set(jobId, {
      ...job,
      status,
      progress,
      message,
      updatedAt: new Date(),
    });
  }
}

module.exports = {
  startResearch,
  getResearchStatus,
  getResearchResults,
};
