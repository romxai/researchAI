const { chromium } = require("playwright");
const pdfParse = require("pdf-parse");
const fs = require("fs/promises");
const debug = require("debug")("researchai:pdf");

debug("PDF processor service initialized");

/**
 * Process papers by downloading PDFs and extracting text using a robust method
 * that handles both direct downloads and in-browser PDF viewing without race conditions.
 * @param {Object} papersByTopic - Object with topics as keys and arrays of paper metadata as values.
 * @returns {Promise<Object>} - Object with processed papers by topic.
 */
const processPapers = async (papersByTopic) => {
  debug(
    "Starting paper processing for %d topics",
    Object.keys(papersByTopic).length
  );
  const processedPapersByTopic = {};

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
  });

  try {
    for (const [topic, papers] of Object.entries(papersByTopic)) {
      debug(`Processing topic: "${topic}" with ${papers.length} papers`);
      console.log(`Processing ${papers.length} papers for topic: ${topic}`);
      const processedPapers = [];

      for (const paper of papers) {
        if (!paper.title) {
          debug("Skipping paper with no title");
          continue;
        }

        const truncatedTitle =
          paper.title.length > 50
            ? paper.title.substring(0, 50) + "..."
            : paper.title;

        if (paper.pdfUrl) {
          debug(`Attempting to download PDF for paper: "${truncatedTitle}"`);
          const page = await context.newPage();

          try {
            let pdfBuffer = null;

            // Listen for the download event
            const downloadPromise = page
              .waitForEvent("download", { timeout: 30000 })
              .catch(() => null);

            // Navigate to the URL
            const response = await page
              .goto(paper.pdfUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
              })
              .catch(() => null);

            // Wait for whichever happens first: a download starts, or the page loads.
            const download = await downloadPromise;

            if (download) {
              // SCENARIO 1: A download was triggered
              const tempPath = await download.path();
              if (!tempPath) throw new Error("Download path not available.");
              pdfBuffer = await fs.readFile(tempPath);
              await fs.unlink(tempPath); // Clean up
            } else if (response && response.ok()) {
              // SCENARIO 2: Page loaded, likely an in-browser PDF viewer
              const contentType = response.headers()["content-type"];
              if (contentType && contentType.includes("application/pdf")) {
                pdfBuffer = await response.buffer();
              } else {
                debug("Page loaded but was not a PDF.");
              }
            } else {
              throw new Error(
                `Navigation failed or response was not OK. Status: ${
                  response ? response.status() : "N/A"
                }`
              );
            }

            if (pdfBuffer && pdfBuffer.length > 0) {
              debug(
                `PDF buffer obtained for paper: "${truncatedTitle}" (size: ${pdfBuffer.length} bytes)`
              );
              const pdfData = await pdfParse(pdfBuffer, { max: 2000000 });
              paper.fullText = pdfData.text;
              debug(
                `Successfully extracted ${pdfData.text.length} characters.`
              );
              console.log(
                `Successfully extracted text from PDF: ${paper.title}`
              );
            } else {
              debug(
                `Failed to obtain a valid PDF buffer for "${truncatedTitle}"`
              );
            }
          } catch (downloadError) {
            debug(
              `Error downloading or processing PDF for "${truncatedTitle}": %O`,
              downloadError
            );
            console.error(
              `Error processing PDF for paper "${paper.title}":`,
              downloadError.message
            );
          } finally {
            if (!page.isClosed()) {
              await page.close();
            }
          }
        } else {
          debug(`No PDF URL available for paper: "${truncatedTitle}"`);
          console.log(`No PDF URL available for paper: ${paper.title}`);
        }
        processedPapers.push(paper);
      }
      processedPapersByTopic[topic] = processedPapers;
    }
  } finally {
    await browser.close();
  }

  debug("Paper processing complete for all topics");
  return processedPapersByTopic;
};

module.exports = {
  processPapers,
};
