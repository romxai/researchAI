const { GoogleGenerativeAI } = require("@google/generative-ai");
const debug = require("debug")("researchai:gemini");

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY || "your-api-key-here";
if (apiKey === "your-api-key-here") {
  debug(
    "WARNING: Using placeholder Gemini API key. Set GEMINI_API_KEY in .env file"
  );
  console.warn(
    "WARNING: Using placeholder Gemini API key. Set GEMINI_API_KEY in .env file"
  );
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

debug("Gemini service initialized");

/**
 * Expand a user query into relevant research topics using Gemini
 * @param {string} query - The user's research query
 * @returns {Promise<string[]>} - Array of expanded research topics
 */
const expandQuery = async (query) => {
  debug("Expanding query: %s", query);
  try {
    const prompt = `
      You are a research assistant helping to expand a research query into relevant subtopics for academic research.
      
      User Query: "${query}"
      
      Please identify 3-5 specific subtopics or research areas related to this query that would be valuable to explore.
      Focus on academic relevance and current research directions.
      
      Format your response as a JSON array of strings, with each string being a specific research subtopic.
      Example: ["Topic 1", "Topic 2", "Topic 3"]
    `;

    debug("Sending prompt to Gemini API");
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    debug(
      "Received response from Gemini API: %s",
      text.substring(0, 200) + (text.length > 200 ? "..." : "")
    );

    // Extract JSON array from response
    const jsonMatch = text.match(/\[.*\]/s);
    if (!jsonMatch) {
      debug("Failed to parse topics from Gemini response: %s", text);
      throw new Error("Failed to parse topics from Gemini response");
    }

    try {
      const topics = JSON.parse(jsonMatch[0]);
      debug("Successfully parsed topics: %O", topics);
      return topics;
    } catch (parseError) {
      debug("JSON parse error for topics: %O", parseError);
      throw new Error(
        `Failed to parse JSON from Gemini response: ${parseError.message}`
      );
    }
  } catch (error) {
    debug("Error expanding query with Gemini: %O", error);
    console.error("Error expanding query with Gemini:", error);
    throw new Error(`Failed to expand research query: ${error.message}`);
  }
};

/**
 * Generate a comprehensive research analysis based on processed papers
 * @param {string} originalQuery - The original user query
 * @param {Object} processedPapers - Object containing processed papers by topic
 * @returns {Promise<Object>} - Research analysis in structured JSON format
 */
const generateResearchAnalysis = async (originalQuery, processedPapers) => {
  debug("Generating research analysis for query: %s", originalQuery);
  try {
    // Prepare paper data for the prompt
    const paperSummaries = [];

    // For each topic, add paper summaries
    Object.entries(processedPapers).forEach(([topic, papers]) => {
      papers.forEach((paper) => {
        if (paper.title && paper.authors && paper.abstract) {
          paperSummaries.push({
            topic,
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            abstract:
              paper.abstract.substring(0, 500) +
              (paper.abstract.length > 500 ? "..." : ""),
            fullText: paper.fullText
              ? paper.fullText.substring(0, 1000) +
                (paper.fullText.length > 1000 ? "..." : "")
              : null,
            url: paper.url,
            citation: paper.citation,
          });
        }
      });
    });

    debug("Prepared %d paper summaries for analysis", paperSummaries.length);
    if (paperSummaries.length === 0) {
      debug("Warning: No valid papers found for analysis");
      throw new Error("No valid papers found for analysis");
    }

    // Create a prompt for Gemini to analyze the papers
    const prompt = `
      You are an academic research assistant tasked with analyzing research papers and creating a comprehensive research guide.
      
      Original Research Query: "${originalQuery}"
      
      I will provide you with information about ${
        paperSummaries.length
      } research papers related to this query.
      
      Paper Information:
      ${JSON.stringify(paperSummaries, null, 2)}
      
      Based on these papers, please create a comprehensive research analysis in JSON format with the following structure:
      
      {
        "summary": "Overall summary of the research area (250-300 words)",
        "keyFindings": [
          {
            "topic": "Topic name",
            "findings": "Key findings for this topic (100-150 words)"
          },
          // More topics...
        ],
        "methodologies": {
          "common": ["List of common methodologies used across papers"],
          "emerging": ["List of newer or emerging methodologies"]
        },
        "researchGaps": [
          "Gap 1 description",
          "Gap 2 description",
          // More gaps...
        ],
        "futureDirections": [
          "Future direction 1",
          "Future direction 2",
          // More future directions...
        ],
        "keyPapers": [
          {
            "title": "Paper title",
            "authors": "Author names",
            "year": "Publication year",
            "summary": "Brief summary of importance (50-75 words)",
            "citation": "Full citation in APA format"
          },
          // 3-5 key papers...
        ],
        "comparativeAnalysis": "Analysis comparing different approaches or findings across papers (200-250 words)"
      }
      
      Ensure your analysis is academically rigorous, properly cites the papers, and provides valuable insights for a researcher.
      Return ONLY the JSON object without any additional text.
    `;

    debug(
      "Sending analysis prompt to Gemini API (prompt length: %d characters)",
      prompt.length
    );
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    debug(
      "Received analysis response from Gemini API (length: %d characters)",
      text.length
    );

    // Extract JSON from response
    const jsonMatch = text.match(/\{.*\}/s);
    if (!jsonMatch) {
      debug(
        "Failed to parse analysis from Gemini response: %s",
        text.substring(0, 200) + (text.length > 200 ? "..." : "")
      );
      throw new Error("Failed to parse analysis from Gemini response");
    }

    try {
      const analysis = JSON.parse(jsonMatch[0]);
      debug(
        "Successfully parsed research analysis (keys: %s)",
        Object.keys(analysis).join(", ")
      );
      return analysis;
    } catch (parseError) {
      debug("JSON parse error for analysis: %O", parseError);
      throw new Error(`Failed to parse JSON analysis: ${parseError.message}`);
    }
  } catch (error) {
    debug("Error generating research analysis with Gemini: %O", error);
    console.error("Error generating research analysis with Gemini:", error);
    throw new Error(`Failed to generate research analysis: ${error.message}`);
  }
};

module.exports = {
  expandQuery,
  generateResearchAnalysis,
};
