const axios = require("axios");
const readline = require("readline");

const API_URL = "http://localhost:3000/api";

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Start a research job
 * @param {string} query - Research query
 * @returns {Promise<string>} - Job ID
 */
async function startResearch(query) {
  try {
    console.log(`Starting research for query: "${query}"...`);
    const response = await axios.post(`${API_URL}/research`, { query });
    console.log("Research job started:");
    console.log(JSON.stringify(response.data, null, 2));
    return response.data.jobId;
  } catch (error) {
    console.error(
      "Error starting research:",
      error.response?.data || error.message
    );
    process.exit(1);
  }
}

/**
 * Check job status
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} - Job status
 */
async function checkStatus(jobId) {
  try {
    const response = await axios.get(`${API_URL}/research/status/${jobId}`);
    console.log("Current job status:");
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(
      "Error checking status:",
      error.response?.data || error.message
    );
    return null;
  }
}

/**
 * Get research results
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} - Research results
 */
async function getResults(jobId) {
  try {
    const response = await axios.get(`${API_URL}/research/results/${jobId}`);
    console.log("Research results:");
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(
      "Error getting results:",
      error.response?.data || error.message
    );
    return null;
  }
}

/**
 * Poll job status until completed
 * @param {string} jobId - Job ID
 * @returns {Promise<void>}
 */
async function pollJobStatus(jobId) {
  console.log("Polling job status...");

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const status = await checkStatus(jobId);

      if (!status) {
        clearInterval(interval);
        resolve(null);
        return;
      }

      if (status.status === "completed") {
        console.log("Job completed!");
        clearInterval(interval);
        resolve(status);
        return;
      }

      if (status.status === "failed") {
        console.log("Job failed!");
        clearInterval(interval);
        resolve(null);
        return;
      }

      console.log(`Progress: ${status.progress}% - ${status.message || ""}`);
    }, 5000); // Check every 5 seconds
  });
}

/**
 * Main function
 */
async function main() {
  rl.question("Enter your research query: ", async (query) => {
    const jobId = await startResearch(query);

    rl.question("Do you want to poll for results? (y/n): ", async (answer) => {
      if (answer.toLowerCase() === "y") {
        await pollJobStatus(jobId);
        await getResults(jobId);
      }

      rl.close();
    });
  });
}

// Run the main function
main();
