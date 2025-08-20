const { chromium } = require("playwright");
const axios = require("axios");

/**
 * Search Google Scholar for papers related to a topic
 * @param {string} topic - The research topic to search for
 * @param {number} maxResults - Maximum number of results to return (default: 10)
 * @returns {Promise<Array>} - Array of paper metadata objects
 */
const searchScholar = async (topic, maxResults = 10) => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
  });

  try {
    console.log(`Searching Google Scholar for: ${topic}`);
    const page = await context.newPage();

    // Navigate to Google Scholar
    await page.goto("https://scholar.google.com/");

    // Accept cookies if the dialog appears
    try {
      const cookieAcceptButton = await page.$('button:has-text("I agree")');
      if (cookieAcceptButton) {
        await cookieAcceptButton.click();
        await page.waitForNavigation({ waitUntil: "networkidle" });
      }
    } catch (error) {
      console.log("No cookie dialog found or already accepted");
    }

    // Enter search query
    await page.fill('input[name="q"]', topic);
    await page.press('input[name="q"]', "Enter");
    await page.waitForLoadState("networkidle");

    // Check for CAPTCHA
    const captchaExists = await page.$$eval(
      "form#captcha-form",
      (forms) => forms.length > 0
    );
    if (captchaExists) {
      throw new Error(
        "CAPTCHA detected. Unable to scrape Google Scholar. Try using a different IP or user agent."
      );
    }

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

    console.log(`Found ${papers.length} papers for topic: ${topic}`);

    return papers;
  } catch (error) {
    console.error(`Error scraping Google Scholar for topic "${topic}":`, error);
    throw new Error(`Failed to scrape Google Scholar: ${error.message}`);
  } finally {
    await browser.close();
  }
};

/**
 * Download a PDF from a URL
 * @param {string} url - URL of the PDF
 * @returns {Promise<Buffer|null>} - PDF buffer or null if download fails
 */
const downloadPdf = async (url) => {
  try {
    if (!url) return null;

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
      },
      timeout: 10000, // 10 seconds timeout
    });

    if (response.status === 200) {
      return Buffer.from(response.data);
    }

    return null;
  } catch (error) {
    console.error(`Error downloading PDF from ${url}:`, error);
    return null;
  }
};

module.exports = {
  searchScholar,
  downloadPdf,
};
