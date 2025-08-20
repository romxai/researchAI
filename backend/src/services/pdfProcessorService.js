const pdfParse = require("pdf-parse");
const scholarScraperService = require("./scholarScraperService");
const debug = require("debug")("researchai:pdf");

debug("PDF processor service initialized");

/**
 * Process papers by downloading PDFs and extracting text
 * @param {Object} papersByTopic - Object with topics as keys and arrays of paper metadata as values
 * @returns {Promise<Object>} - Object with processed papers by topic
 */
const processPapers = async (papersByTopic) => {
  debug(
    "Starting paper processing for %d topics",
    Object.keys(papersByTopic).length
  );
  const processedPapersByTopic = {};
  const topicCount = Object.keys(papersByTopic).length;
  let currentTopicIndex = 0;

  for (const [topic, papers] of Object.entries(papersByTopic)) {
    currentTopicIndex++;
    debug(
      `Processing topic ${currentTopicIndex}/${topicCount}: "${topic}" with ${papers.length} papers`
    );
    console.log(`Processing ${papers.length} papers for topic: ${topic}`);

    const processedPapers = [];
    let successfulDownloads = 0;
    let failedDownloads = 0;
    let noPdfUrl = 0;

    for (const paper of papers) {
      try {
        // Skip papers without title
        if (!paper.title) {
          debug("Skipping paper with no title");
          continue;
        }

        const truncatedTitle =
          paper.title.length > 50
            ? paper.title.substring(0, 50) + "..."
            : paper.title;

        debug(`Processing paper: "${truncatedTitle}"`);

        // Only try to download if a PDF URL is available
        if (paper.pdfUrl) {
          debug(
            `Downloading PDF for paper: "${truncatedTitle}" from URL: ${paper.pdfUrl}`
          );
          console.log(`Downloading PDF for paper: ${paper.title}`);

          const pdfBuffer = await scholarScraperService.downloadPdf(
            paper.pdfUrl
          );

          if (pdfBuffer) {
            debug(
              `PDF downloaded successfully for paper: "${truncatedTitle}" (size: ${pdfBuffer.length} bytes)`
            );

            try {
              // Extract text from PDF
              debug("Parsing PDF content");
              const pdfData = await pdfParse(pdfBuffer, {
                max: 1000000, // Limit to 1 million characters to prevent memory issues
              });

              // Add full text to paper object
              paper.fullText = pdfData.text;
              debug(
                `Successfully extracted ${pdfData.text.length} characters of text from PDF: "${truncatedTitle}"`
              );
              console.log(
                `Successfully extracted text from PDF: ${paper.title}`
              );

              // Extract additional info if available
              if (pdfData.info) {
                debug("PDF metadata available: %O", pdfData.info);
                // Could store metadata if needed
              }

              successfulDownloads++;
            } catch (parseError) {
              debug(
                `Error parsing PDF for paper "${truncatedTitle}": %O`,
                parseError
              );
              console.error(
                `Error parsing PDF for paper "${paper.title}":`,
                parseError
              );
              failedDownloads++;
            }
          } else {
            debug(`Failed to download PDF for paper: "${truncatedTitle}"`);
            console.log(`Failed to download PDF for paper: ${paper.title}`);
            failedDownloads++;
          }
        } else {
          debug(`No PDF URL available for paper: "${truncatedTitle}"`);
          console.log(`No PDF URL available for paper: ${paper.title}`);
          noPdfUrl++;
        }

        // Add processed paper to the list
        processedPapers.push(paper);
      } catch (error) {
        debug(
          `Error processing paper "${paper.title || "unknown"}": %O`,
          error
        );
        console.error(
          `Error processing paper "${paper.title || "unknown"}":`,
          error
        );
        // Still add the paper to the list, just without full text
        processedPapers.push(paper);
      }
    }

    debug(
      `Topic "${topic}" processing complete: ${successfulDownloads} successful downloads, ${failedDownloads} failed downloads, ${noPdfUrl} papers without PDF URLs`
    );
    processedPapersByTopic[topic] = processedPapers;
  }

  debug("Paper processing complete for all topics");
  return processedPapersByTopic;
};

/**
 * Extract key information from PDF text
 * @param {string} text - Full text extracted from PDF
 * @returns {Object} - Extracted information
 */
const extractInfoFromPdf = (text) => {
  debug(
    "Extracting structured information from PDF text (length: %d characters)",
    text ? text.length : 0
  );

  if (!text || text.length < 100) {
    debug("Text too short for meaningful extraction");
    return {};
  }

  // This is a simple implementation that could be enhanced with more sophisticated NLP
  const sections = {};

  try {
    // Try to identify abstract
    debug("Looking for abstract section");
    const abstractMatch = text.match(
      /abstract([\s\S]*?)(?:introduction|keywords|1\.)/i
    );
    if (abstractMatch) {
      sections.abstract = abstractMatch[1].trim();
      debug("Abstract found: %d characters", sections.abstract.length);
    } else {
      debug("Abstract section not found");
    }

    // Try to identify introduction
    debug("Looking for introduction section");
    const introMatch = text.match(
      /introduction([\s\S]*?)(?:2\.|background|related work)/i
    );
    if (introMatch) {
      sections.introduction = introMatch[1].trim();
      debug("Introduction found: %d characters", sections.introduction.length);
    } else {
      debug("Introduction section not found");
    }

    // Try to identify methodology/methods
    debug("Looking for methodology section");
    const methodMatch = text.match(
      /(?:methodology|methods|experimental setup)([\s\S]*?)(?:results|evaluation|4\.)/i
    );
    if (methodMatch) {
      sections.methodology = methodMatch[1].trim();
      debug("Methodology found: %d characters", sections.methodology.length);
    } else {
      debug("Methodology section not found");
    }

    // Try to identify results
    debug("Looking for results section");
    const resultsMatch = text.match(
      /(?:results|findings|evaluation)([\s\S]*?)(?:discussion|conclusion|5\.)/i
    );
    if (resultsMatch) {
      sections.results = resultsMatch[1].trim();
      debug("Results found: %d characters", sections.results.length);
    } else {
      debug("Results section not found");
    }

    // Try to identify conclusion
    debug("Looking for conclusion section");
    const conclusionMatch = text.match(
      /(?:conclusion|conclusions|discussion|future work)([\s\S]*?)(?:references|bibliography|acknowledgements|$)/i
    );
    if (conclusionMatch) {
      sections.conclusion = conclusionMatch[1].trim();
      debug("Conclusion found: %d characters", sections.conclusion.length);
    } else {
      debug("Conclusion section not found");
    }

    debug(
      "Section extraction complete: found %d sections",
      Object.keys(sections).length
    );
  } catch (error) {
    debug("Error extracting sections from PDF text: %O", error);
    console.error("Error extracting sections from PDF text:", error);
  }

  return sections;
};

module.exports = {
  processPapers,
  extractInfoFromPdf,
};
