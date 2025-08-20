const { chromium } = require("playwright");

(async () => {
  console.log("Installing Playwright browsers...");

  try {
    // This will download the Chromium browser if it's not already installed
    const browser = await chromium.launch();
    await browser.close();

    console.log("Playwright setup completed successfully!");
  } catch (error) {
    console.error("Error setting up Playwright:", error);
    process.exit(1);
  }
})();
