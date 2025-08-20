const { v4: uuidv4 } = require("uuid");
const Bull = require("bull");
const geminiService = require("../services/geminiService");
const scholarScraperService = require("../services/scholarScraperService");
const pdfProcessorService = require("../services/pdfProcessorService");
const debug = require("debug")("researchai:controller");

// In-memory storage for job status and results
// In a production app, this would be a database
const jobs = new Map();
const results = new Map();

// Create a Bull queue for processing research jobs
const researchQueue = new Bull("research-queue", {
  // In a production app, you would use Redis URL from env
  // For local development, we use the default Redis connection
  redis: process.env.REDIS_URL || {
    port: 6379,
    host: "127.0.0.1",
  },
});

// Handle Redis connection errors
researchQueue.on("error", (error) => {
  debug("Redis connection error: %O", error);
  console.error("Redis connection error:", error);
});

// Handle Bull queue errors
researchQueue.on("failed", (job, error) => {
  debug("Job failed: %s, Error: %O", job.id, error);
  console.error(`Job ${job.id} failed:`, error);
});

// Log successful job completions
researchQueue.on("completed", (job) => {
  debug("Job completed: %s", job.id);
});

/**
 * Start a new research job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const startResearch = async (req, res) => {
  try {
    debug("Starting research job with request: %O", req.body);
    const { query } = req.body;

    if (!query) {
      debug("Query is missing in request body");
      return res
        .status(400)
        .json({ error: true, message: "Query is required" });
    }

    // Generate a unique job ID
    const jobId = uuidv4();
    debug("Generated job ID: %s", jobId);

    // Store initial job status
    jobs.set(jobId, {
      id: jobId,
      status: "queued",
      progress: 0,
      createdAt: new Date(),
      query,
    });
    debug("Job status initialized: %O", jobs.get(jobId));

    // Add job to queue
    try {
      await researchQueue.add(
        "process-research",
        {
          jobId,
          query,
        },
        {
          attempts: 3, // Retry up to 3 times
          backoff: {
            type: "exponential",
            delay: 5000, // 5 seconds initial delay
          },
        }
      );
      debug("Job added to queue successfully: %s", jobId);
    } catch (queueError) {
      debug("Error adding job to queue: %O", queueError);
      throw new Error(`Failed to queue job: ${queueError.message}`);
    }

    res.status(202).json({
      jobId,
      status: "queued",
      message: "Research job has been queued",
    });
  } catch (error) {
    debug("Error starting research job: %O", error);
    console.error("Error starting research job:", error);
    res.status(500).json({
      error: true,
      message: "Failed to start research job: " + error.message,
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
    debug("Getting status for job ID: %s", jobId);

    if (!jobs.has(jobId)) {
      debug("Job not found in memory: %s", jobId);
      return res.status(404).json({
        error: true,
        message: "Job not found",
      });
    }

    const job = jobs.get(jobId);
    debug("Retrieved job status: %O", job);

    res.status(200).json({
      jobId,
      status: job.status,
      progress: job.progress,
      message: job.message || "",
      createdAt: job.createdAt,
      updatedAt: job.updatedAt || job.createdAt,
    });
  } catch (error) {
    debug("Error getting job status: %O", error);
    console.error("Error getting job status:", error);
    res.status(500).json({
      error: true,
      message: "Failed to get job status: " + error.message,
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
    debug("Getting results for job ID: %s", jobId);

    if (!jobs.has(jobId)) {
      debug("Job not found in memory: %s", jobId);
      return res.status(404).json({
        error: true,
        message: "Job not found",
      });
    }

    const job = jobs.get(jobId);
    debug("Job status for results request: %O", job);

    if (job.status !== "completed") {
      debug("Job not completed yet: %s, current status: %s", jobId, job.status);
      return res.status(400).json({
        error: true,
        message: `Job is not completed yet. Current status: ${job.status}`,
      });
    }

    if (!results.has(jobId)) {
      debug("Results not found for completed job: %s", jobId);
      return res.status(404).json({
        error: true,
        message: "Results not found",
      });
    }

    const result = results.get(jobId);
    debug(
      "Retrieved results for job: %s (size: %d bytes)",
      jobId,
      JSON.stringify(result).length
    );

    res.status(200).json(result);
  } catch (error) {
    debug("Error getting job results: %O", error);
    console.error("Error getting job results:", error);
    res.status(500).json({
      error: true,
      message: "Failed to get job results: " + error.message,
    });
  }
};

// Process research jobs in the queue
researchQueue.process("process-research", async (job) => {
  const { jobId, query } = job.data;
  debug("Processing research job: %s with query: %s", jobId, query);

  try {
    // Update job status
    updateJobStatus(
      jobId,
      "processing",
      10,
      "Expanding research query with Gemini"
    );

    // Step 1: Expand query into relevant topics using Gemini
    debug("Step 1: Expanding query with Gemini for job: %s", jobId);
    let expandedTopics;
    try {
      expandedTopics = await geminiService.expandQuery(query);
      debug("Query expanded into topics: %O", expandedTopics);
    } catch (geminiError) {
      debug("Error expanding query with Gemini: %O", geminiError);
      updateJobStatus(
        jobId,
        "failed",
        0,
        `Failed to expand query: ${geminiError.message}`
      );
      throw geminiError;
    }

    updateJobStatus(
      jobId,
      "processing",
      20,
      "Searching Google Scholar for relevant papers"
    );

    // Step 2: Scrape Google Scholar for each topic
    debug("Step 2: Scraping Google Scholar for job: %s", jobId);
    const papersByTopic = {};
    let overallProgress = 20;
    const progressPerTopic = 50 / expandedTopics.length;

    for (let i = 0; i < expandedTopics.length; i++) {
      const topic = expandedTopics[i];
      const currentProgress = Math.floor(
        overallProgress + i * progressPerTopic
      );

      updateJobStatus(
        jobId,
        "processing",
        currentProgress,
        `Searching for papers on: ${topic}`
      );

      try {
        debug("Searching Google Scholar for topic: %s (job: %s)", topic, jobId);
        const papers = await scholarScraperService.searchScholar(topic);
        debug("Found %d papers for topic: %s", papers.length, topic);
        papersByTopic[topic] = papers;
      } catch (scholarError) {
        debug(
          "Error searching Google Scholar for topic %s: %O",
          topic,
          scholarError
        );
        // Continue with other topics even if one fails
        papersByTopic[topic] = [];
        // Log error but don't fail the entire job for one topic
        console.error(`Error searching for topic "${topic}":`, scholarError);
      }
    }

    // Check if we have any papers at all
    const totalPapers = Object.values(papersByTopic).reduce(
      (sum, papers) => sum + papers.length,
      0
    );

    if (totalPapers === 0) {
      debug("No papers found for any topic. Job failed: %s", jobId);
      updateJobStatus(
        jobId,
        "failed",
        0,
        "No research papers found for any topic"
      );
      throw new Error("No research papers found for any topic");
    }

    debug("Total papers found across all topics: %d", totalPapers);
    updateJobStatus(
      jobId,
      "processing",
      70,
      "Downloading and processing papers"
    );

    // Step 3: Process papers (download PDFs, extract text)
    debug("Step 3: Processing papers for job: %s", jobId);
    let processedPapers;
    try {
      processedPapers = await pdfProcessorService.processPapers(papersByTopic);
      debug("Papers processed successfully for job: %s", jobId);
    } catch (processingError) {
      debug("Error processing papers: %O", processingError);
      updateJobStatus(
        jobId,
        "failed",
        0,
        `Error processing papers: ${processingError.message}`
      );
      throw processingError;
    }

    updateJobStatus(
      jobId,
      "processing",
      90,
      "Generating research analysis with Gemini"
    );

    // Step 4: Generate research analysis with Gemini
    debug("Step 4: Generating research analysis for job: %s", jobId);
    let researchAnalysis;
    try {
      researchAnalysis = await geminiService.generateResearchAnalysis(
        query,
        processedPapers
      );
      debug("Research analysis generated successfully for job: %s", jobId);
    } catch (analysisError) {
      debug("Error generating research analysis: %O", analysisError);
      updateJobStatus(
        jobId,
        "failed",
        0,
        `Error generating research analysis: ${analysisError.message}`
      );
      throw analysisError;
    }

    // Store results
    debug("Storing results for job: %s", jobId);
    results.set(jobId, {
      query,
      expandedTopics,
      papersByTopic: processedPapers,
      analysis: researchAnalysis,
    });

    // Mark job as completed
    updateJobStatus(jobId, "completed", 100, "Research analysis completed");
    debug("Job completed successfully: %s", jobId);

    return { success: true };
  } catch (error) {
    debug("Error processing research job %s: %O", jobId, error);
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
    const updatedJob = {
      ...job,
      status,
      progress,
      message,
      updatedAt: new Date(),
    };

    jobs.set(jobId, updatedJob);
    debug(
      "Updated job status: %s, status: %s, progress: %d%, message: %s",
      jobId,
      status,
      progress,
      message
    );
  } else {
    debug(
      "Warning: Attempted to update status for non-existent job: %s",
      jobId
    );
  }
}

module.exports = {
  startResearch,
  getResearchStatus,
  getResearchResults,
};
