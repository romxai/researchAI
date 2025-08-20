const { v4: uuidv4 } = require("uuid");
const Bull = require("bull");
const geminiService = require("../services/geminiService");
const scholarScraperService = require("../services/scholarScraperService");
const pdfProcessorService = require("../services/pdfProcessorService");
const debug = require("debug")("researchai:controller");

const jobs = new Map();
const results = new Map();

const researchQueue = new Bull("research-queue", {
  redis: process.env.REDIS_URL || {
    port: 6379,
    host: "127.0.0.1",
  },
  settings: {
    // Increase the timeout to 5 minutes to prevent stalling
    lockDuration: 300000,
  },
});

researchQueue.on("error", (error) => {
  debug("Redis connection error: %O", error);
  console.error("Redis connection error:", error);
});

researchQueue.on("failed", (job, error) => {
  debug("Job failed: %s, Error: %O", job.id, error);
  console.error(`Job ${job.id} failed:`, error);
});

researchQueue.on("completed", (job) => {
  debug("Job completed: %s", job.id);
});

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

    const jobId = uuidv4();
    debug("Generated job ID: %s", jobId);

    jobs.set(jobId, {
      id: jobId,
      status: "queued",
      progress: 0,
      createdAt: new Date(),
      query,
    });
    debug("Job status initialized: %O", jobs.get(jobId));

    await researchQueue.add(
      "process-research",
      {
        jobId,
        query,
      },
      {
        attempts: 2,
        // Increased timeout for the job itself to 10 minutes
        timeout: 600000,
        backoff: {
          type: "exponential",
          delay: 10000,
        },
      }
    );
    debug("Job added to queue successfully: %s", jobId);

    res.status(202).json({
      jobId,
      status: "queued",
      message: "Research job has been queued",
    });
  } catch (error) {
    debug("Error starting research job: %O", error);
    res.status(500).json({
      error: true,
      message: "Failed to start research job: " + error.message,
    });
  }
};

const getResearchStatus = (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobs.has(jobId)) {
      return res.status(404).json({ error: true, message: "Job not found" });
    }
    const job = jobs.get(jobId);
    res.status(200).json({
      jobId,
      status: job.status,
      progress: job.progress,
      message: job.message || "",
      createdAt: job.createdAt,
      updatedAt: job.updatedAt || job.createdAt,
    });
  } catch (error) {
    console.error("Error getting job status:", error);
    res.status(500).json({ error: true, message: "Failed to get job status" });
  }
};

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

researchQueue.process("process-research", async (job) => {
  const { jobId, query } = job.data;
  debug("Processing research job: %s with query: %s", jobId, query);

  try {
    updateJobStatus(jobId, "processing", 10, "Expanding research query");
    await job.progress(10);

    const expandedTopics = await geminiService.expandQuery(query);

    updateJobStatus(jobId, "processing", 20, "Searching Google Scholar");
    await job.progress(20);

    const papersByTopic = {};
    for (let i = 0; i < expandedTopics.length; i++) {
      const topic = expandedTopics[i];
      const progress = 20 + (i / expandedTopics.length) * 30;
      updateJobStatus(jobId, "processing", progress, `Searching for: ${topic}`);
      await job.progress(progress);
      try {
        const papers = await scholarScraperService.searchScholar(topic, 5);
        papersByTopic[topic] = papers;
      } catch (scholarError) {
        console.error(`Error searching for topic "${topic}":`, scholarError);
        papersByTopic[topic] = [];
      }
    }

    const totalPapers = Object.values(papersByTopic).reduce(
      (sum, papers) => sum + papers.length,
      0
    );
    if (totalPapers === 0) {
      throw new Error(
        "No research papers could be found for the given topics."
      );
    }

    updateJobStatus(jobId, "processing", 50, "Processing PDFs");
    await job.progress(50);

    console.log("--- Controller: Starting PDF processing ---");
    const processedPapers = await pdfProcessorService.processPapers(
      papersByTopic
    );
    console.log("--- Controller: Finished PDF processing ---");

    updateJobStatus(jobId, "processing", 90, "Generating research analysis");
    await job.progress(90);

    console.log("--- Controller: Starting Gemini analysis ---");
    const researchAnalysis = await geminiService.generateResearchAnalysis(
      query,
      processedPapers
    );
    console.log("--- Controller: Finished Gemini analysis ---");

    results.set(jobId, {
      query,
      expandedTopics,
      papersByTopic: processedPapers,
      analysis: researchAnalysis,
    });

    updateJobStatus(jobId, "completed", 100, "Research analysis completed");
    await job.progress(100);
    console.log(`--- Job ${jobId} Completed Successfully ---`);

    return { success: true };
  } catch (error) {
    debug("Error processing research job %s: %O", jobId, error);
    updateJobStatus(jobId, "failed", 0, `Error: ${error.message}`);
    throw error; // This ensures Bull knows the job failed
  }
});

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
