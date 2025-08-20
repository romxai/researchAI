const pdfParse = require("pdf-parse");
const scholarScraperService = require("./scholarScraperService");

/**
 * Process papers by downloading PDFs and extracting text
 * @param {Object} papersByTopic - Object with topics as keys and arrays of paper metadata as values
 * @returns {Promise<Object>} - Object with processed papers by topic
 */
const processPapers = async (papersByTopic) => {
  const processedPapersByTopic = {};

  for (const [topic, papers] of Object.entries(papersByTopic)) {
    console.log(`Processing ${papers.length} papers for topic: ${topic}`);

    const processedPapers = [];

    for (const paper of papers) {
      try {
        // Only try to download if a PDF URL is available
        if (paper.pdfUrl) {
          console.log(`Downloading PDF for paper: ${paper.title}`);
          const pdfBuffer = await scholarScraperService.downloadPdf(
            paper.pdfUrl
          );

          if (pdfBuffer) {
            // Extract text from PDF
            const pdfData = await pdfParse(pdfBuffer);

            // Add full text to paper object
            paper.fullText = pdfData.text;
            console.log(`Successfully extracted text from PDF: ${paper.title}`);
          } else {
            console.log(`Failed to download PDF for paper: ${paper.title}`);
          }
        } else {
          console.log(`No PDF URL available for paper: ${paper.title}`);
        }

        // Add processed paper to the list
        processedPapers.push(paper);
      } catch (error) {
        console.error(`Error processing paper "${paper.title}":`, error);
        // Still add the paper to the list, just without full text
        processedPapers.push(paper);
      }
    }

    processedPapersByTopic[topic] = processedPapers;
  }

  return processedPapersByTopic;
};

/**
 * Extract key information from PDF text
 * @param {string} text - Full text extracted from PDF
 * @returns {Object} - Extracted information
 */
const extractInfoFromPdf = (text) => {
  // This is a simple implementation that could be enhanced with more sophisticated NLP
  const sections = {};

  // Try to identify abstract
  const abstractMatch = text.match(
    /abstract([\s\S]*?)(?:introduction|keywords|1\.)/i
  );
  if (abstractMatch) {
    sections.abstract = abstractMatch[1].trim();
  }

  // Try to identify introduction
  const introMatch = text.match(
    /introduction([\s\S]*?)(?:2\.|background|related work)/i
  );
  if (introMatch) {
    sections.introduction = introMatch[1].trim();
  }

  // Try to identify methodology/methods
  const methodMatch = text.match(
    /(?:methodology|methods|experimental setup)([\s\S]*?)(?:results|evaluation|4\.)/i
  );
  if (methodMatch) {
    sections.methodology = methodMatch[1].trim();
  }

  // Try to identify results
  const resultsMatch = text.match(
    /(?:results|findings|evaluation)([\s\S]*?)(?:discussion|conclusion|5\.)/i
  );
  if (resultsMatch) {
    sections.results = resultsMatch[1].trim();
  }

  // Try to identify conclusion
  const conclusionMatch = text.match(
    /(?:conclusion|conclusions|discussion|future work)([\s\S]*?)(?:references|bibliography|acknowledgements|$)/i
  );
  if (conclusionMatch) {
    sections.conclusion = conclusionMatch[1].trim();
  }

  return sections;
};

module.exports = {
  processPapers,
  extractInfoFromPdf,
};
