const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Check if .env file exists
const envPath = path.join(__dirname, ".env");
const envExamplePath = path.join(__dirname, "env.example");

if (!fs.existsSync(envPath)) {
  console.log("No .env file found. Creating one from env.example...");

  try {
    // Copy env.example to .env
    fs.copyFileSync(envExamplePath, envPath);
    console.log(".env file created successfully!");

    // Prompt for Gemini API key
    rl.question("Please enter your Gemini API key: ", (apiKey) => {
      if (apiKey && apiKey.trim()) {
        // Update .env file with API key
        let envContent = fs.readFileSync(envPath, "utf8");
        envContent = envContent.replace(
          "GEMINI_API_KEY=your-gemini-api-key-here",
          `GEMINI_API_KEY=${apiKey.trim()}`
        );
        fs.writeFileSync(envPath, envContent);
        console.log("API key saved to .env file.");
      } else {
        console.log(
          "No API key provided. You will need to update the .env file manually."
        );
      }

      startServer();
      rl.close();
    });
  } catch (error) {
    console.error("Error creating .env file:", error);
    process.exit(1);
  }
} else {
  console.log(".env file already exists.");
  startServer();
  rl.close();
}

function startServer() {
  console.log("Checking Redis connection...");

  // Check if Redis is running
  const redisCheck = spawn("npm", ["run", "test-redis"], {
    stdio: "inherit",
    shell: true,
  });

  redisCheck.on("close", (code) => {
    if (code !== 0) {
      console.error("Redis check failed. Please make sure Redis is running.");
      console.log("See the README.md for Redis installation instructions.");
      console.log("To bypass this check, run 'npm run dev' directly.");
      process.exit(1);
    }

    console.log("\nStarting server...");

    // Start the server using npm run dev
    const server = spawn("npm", ["run", "dev"], {
      stdio: "inherit",
      shell: true,
    });

    server.on("error", (error) => {
      console.error("Failed to start server:", error);
    });

    // Handle SIGINT (Ctrl+C) to gracefully shut down
    process.on("SIGINT", () => {
      console.log("Shutting down server...");
      server.kill("SIGINT");
      process.exit(0);
    });
  });
}
