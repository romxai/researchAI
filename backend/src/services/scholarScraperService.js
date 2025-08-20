const { chromium } = require("playwright");
const axios = require("axios");
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
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
    });
    debug("Browser context created");

    console.log(`Searching Google Scholar for: ${topic}`);
    const page = await context.newPage();
    debug("New page created");

    // Navigate to Google Scholar
    debug("Navigating to Google Scholar");
    try {
      await page.goto("https://scholar.google.com/", {
        timeout: 30000, // 30 seconds timeout
        waitUntil: "networkidle",
      });
      debug("Successfully navigated to Google Scholar");
    } catch (navError) {
      debug("Navigation error: %O", navError);
      throw new Error(
        `Failed to navigate to Google Scholar: ${navError.message}`
      );
    }

    // Accept cookies if the dialog appears
    try {
      debug("Checking for cookie consent dialog");
      const cookieAcceptButton = await page.$('button:has-text("I agree")');
      if (cookieAcceptButton) {
        debug("Cookie consent dialog found, clicking 'I agree'");
        await cookieAcceptButton.click();
        await page.waitForNavigation({ waitUntil: "networkidle" });
        debug("Cookie consent accepted");
      } else {
        debug("No cookie consent dialog found");
      }
    } catch (cookieError) {
      debug("Error handling cookie dialog: %O", cookieError);
      console.log("No cookie dialog found or already accepted");
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

    // Take screenshot for debugging if needed
    try {
      const screenshot = await page.screenshot();
      debug(
        "Screenshot taken of search results page (size: %d bytes)",
        screenshot.length
      );
    } catch (screenshotError) {
      debug("Failed to take screenshot: %O", screenshotError);
    }

    // Check for CAPTCHA
    debug("Checking for CAPTCHA");
    const captchaExists = await page.$$eval(
      "form#captcha-form",
      (forms) => forms.length > 0
    );

    if (captchaExists) {
      debug("CAPTCHA detected on Google Scholar");
      throw new Error(
        "CAPTCHA detected. Unable to scrape Google Scholar. Try using a different IP or user agent."
      );
    }
    debug("No CAPTCHA detected");

    // Check if we have any results
    const resultsExist = await page.$$(".gs_ri");
    if (!resultsExist || resultsExist.length === 0) {
      debug("No search results found for topic: %s", topic);
      return []; // Return empty array instead of throwing error
    }
    debug("Found search results, extracting data");

    // Extract paper information
    const papers = await page.$$eval(
      ".gs_ri",
      (results, maxCount) => {
        return results.slice(0, maxCount).map((result) => {
          // Extract title and link
          const titleElement = result.querySelector(".gs_rt a");
          const title = titleElement
            ? titleElement.textContent
            : "Unknown Title";
          const url = titleElement ? titleElement.href : null;

          // Extract authors, publication, year
          const metaElement = result.querySelector(".gs_a");
          const metaText = metaElement ? metaElement.textContent : "";

          // Parse authors (text before the first dash)
          const authors = metaText.split(" - ")[0] || "Unknown Authors";

          // Try to extract year using regex
          const yearMatch = metaText.match(/\\d{4}/);
          const year = yearMatch ? yearMatch[0] : "Unknown Year";

          // Extract publication venue (text between first and second dash)
          const metaParts = metaText.split(" - ");
          const publication =
            metaParts.length > 1 ? metaParts[1] : "Unknown Publication";

          // Extract abstract
          const abstractElement = result.querySelector(".gs_rs");
          const abstract = abstractElement
            ? abstractElement.textContent.trim()
            : "";

          // Extract citation information
          const citedByElement = result.querySelector(".gs_fl a:nth-child(3)");
          const citedByText = citedByElement ? citedByElement.textContent : "";
          const citationCount = citedByText.match(/\\d+/)
            ? parseInt(citedByText.match(/\\d+/)[0])
            : 0;

          // Check if PDF is available
          const pdfLink =
            Array.from(result.querySelectorAll(".gs_or_ggsm a")).find(
              (a) => a.textContent.includes("[PDF]") || a.href.includes(".pdf")
            )?.href || null;

          // Create citation in APA format
          const citation = `${authors}. (${year}). ${title}. ${publication}.`;

          return {
            title,
            authors,
            year,
            publication,
            abstract,
            url,
            pdfUrl: pdfLink,
            citationCount,
            citation,
            fullText: null, // Will be populated later if PDF is available
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

/**
 * Download a PDF from a URL
 * @param {string} url - URL of the PDF
 * @returns {Promise<Buffer|null>} - PDF buffer or null if download fails
 */
const downloadPdf = async (url) => {
  if (!url) {
    debug("No PDF URL provided");
    return null;
  }

  debug("Downloading PDF from URL: %s", url);
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
      },
      timeout: 15000, // 15 seconds timeout
      maxContentLength: 10 * 1024 * 1024, // 10MB max size
    });

    if (response.status === 200) {
      const pdfBuffer = Buffer.from(response.data);
      debug(
        "PDF downloaded successfully: %s (size: %d bytes)",
        url,
        pdfBuffer.length
      );

      // Check if the downloaded content is actually a PDF
      const isPdf =
        pdfBuffer.length > 4 && pdfBuffer.toString("ascii", 0, 4) === "%PDF";

      if (!isPdf) {
        debug("Downloaded content is not a PDF: %s", url);
        return null;
      }

      return pdfBuffer;
    }

    debug("Failed to download PDF, status code: %d", response.status);
    return null;
  } catch (error) {
    debug("Error downloading PDF from %s: %O", url, error);
    console.error(`Error downloading PDF from ${url}:`, error);
    return null;
  }
};

module.exports = {
  searchScholar,
  downloadPdf,
};
