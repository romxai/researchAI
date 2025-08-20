const { chromium } = require("playwright");
const debug = require("debug")("researchai:scholar");

debug("Scholar scraper service initialized");

/**
 * Search Google Scholar for papers related to a topic
 * @param {string} topic - The research topic to search for
 * @param {number} maxResults - Maximum number of results to return (default: 10)
 * @returns {Promise<Array>} - Array of paper metadata objects
 */
const searchScholar = async (topic, maxResults = 10) => {
  debug(
    `Starting Google Scholar search for topic: "${topic}" (max results: ${maxResults})`
  );

  let browser;
  try {
    debug("Launching Playwright browser");
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    });
    debug("Browser context created");

    console.log(`Searching Google Scholar for: ${topic}`);
    const page = await context.newPage();
    debug("New page created");

    // Navigate to Google Scholar
    debug("Navigating to Google Scholar");
    try {
      await page.goto("https://scholar.google.com/", {
        timeout: 30000,
        waitUntil: "networkidle",
      });
      debug("Successfully navigated to Google Scholar");
    } catch (navError) {
      debug("Navigation error: %O", navError);
      throw new Error(
        `Failed to navigate to Google Scholar: ${navError.message}`
      );
    }

    // Enter search query
    debug(`Entering search query: "${topic}"`);
    await page.fill('input[name="q"]', topic);
    await page.press('input[name="q"]', "Enter");

    try {
      await page.waitForLoadState("networkidle", { timeout: 30000 });
      debug("Search results page loaded");
    } catch (loadError) {
      debug("Error waiting for search results page: %O", loadError);
      throw new Error(
        `Timeout waiting for search results: ${loadError.message}`
      );
    }

    // Check for CAPTCHA
    debug("Checking for CAPTCHA");
    const captchaExists = await page.$$eval(
      "form#captcha-form",
      (forms) => forms.length > 0
    );

    if (captchaExists) {
      debug("CAPTCHA detected on Google Scholar");
      throw new Error("CAPTCHA detected. Unable to scrape Google Scholar.");
    }
    debug("No CAPTCHA detected");

    // Extract paper information
    const papers = await page.$$eval(
      ".gs_ri",
      (results, maxCount) => {
        return results.slice(0, maxCount).map((result) => {
          const titleElement = result.querySelector(".gs_rt a");
          const title = titleElement
            ? titleElement.textContent
            : "Unknown Title";
          const url = titleElement ? titleElement.href : null;

          const metaElement = result.querySelector(".gs_a");
          const metaText = metaElement ? metaElement.textContent : "";
          const authors = metaText.split(" - ")[0] || "Unknown Authors";
          const yearMatch = metaText.match(/\d{4}/);
          const year = yearMatch ? yearMatch[0] : "Unknown Year";
          const metaParts = metaText.split(" - ");
          const publication =
            metaParts.length > 1 ? metaParts[1] : "Unknown Publication";

          const abstractElement = result.querySelector(".gs_rs");
          const abstract = abstractElement
            ? abstractElement.textContent.trim()
            : "";

          const citedByElement = result.querySelector(
            "a:not([class]):not([id])"
          );
          const citedByText = citedByElement ? citedByElement.textContent : "";
          const citationCount = citedByText.match(/\d+/)
            ? parseInt(citedByText.match(/\d+/)[0])
            : 0;

          const pdfLinkElement = result
            .closest(".gs_r")
            .querySelector(".gs_or_ggsm a");
          const pdfUrl = pdfLinkElement ? pdfLinkElement.href : null;

          const citation = `${authors}. (${year}). ${title}. ${publication}.`;

          return {
            title,
            authors,
            year,
            publication,
            abstract,
            url,
            pdfUrl: pdfUrl,
            citationCount,
            citation,
            fullText: null,
          };
        });
      },
      maxResults
    );

    debug(`Extracted ${papers.length} papers for topic: ${topic}`);
    console.log(`Found ${papers.length} papers for topic: ${topic}`);

    return papers;
  } catch (error) {
    debug(`Error scraping Google Scholar for topic "${topic}": %O`, error);
    console.error(`Error scraping Google Scholar for topic "${topic}":`, error);
    throw new Error(`Failed to scrape Google Scholar: ${error.message}`);
  } finally {
    if (browser) {
      debug("Closing browser");
      await browser.close().catch((err) => {
        debug("Error closing browser: %O", err);
      });
    }
  }
};

// This is the line that was likely missing or incorrect
module.exports = {
  searchScholar,
};
