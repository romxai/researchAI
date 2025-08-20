# Research Assistant API

This is the backend service for the Research Assistant application. It's a powerful tool that takes a user's research query, expands it into relevant topics using the Gemini API, scrapes Google Scholar for academic papers, and then uses Gemini again to generate a comprehensive, academic-style research guide.

------------------------------------------------------------------------

## How It Works

The application follows a simple but powerful workflow:

1.  **Query Input**: A researcher provides an initial query.
2.  **Query Expansion**: The Gemini API expands this query into a set of relevant sub-topics.
3.  **Web Scraping**: The backend uses Playwright to scrape Google Scholar for research papers related to these topics.
4.  **Content Processing**: It collects freely available PDFs and their metadata.
5.  **AI Analysis**: The Gemini API processes the collected information to extract key findings, identify research gaps, and format the output into a structured academic guide with citations.
6.  **Results**: The final research guide is made available through the API.

------------------------------------------------------------------------

## Getting Started

### Prerequisites

-   **Node.js** (v14 or later)
-   **npm** or **yarn**
-   A **Google Gemini API key**
-   **Redis** for the job queue

### Redis Installation

-   **Windows**: You can download Redis for Windows from the official [GitHub releases](https://github.com/microsoftarchive/redis/releases), use WSL2 for a Linux-based installation, or run it via Docker with the command: `docker run --name redis -p 6379:6379 -d redis`.

-   **macOS**:

    ``` bash
    brew install redis
    brew services start redis
    ```

-   **Linux (Ubuntu/Debian)**:

    ``` bash
    sudo apt update
    sudo apt install redis-server
    sudo systemctl start redis-server
    ```

To confirm that Redis is running correctly, use the command `redis-cli ping`. You should see `PONG` as a response.

### Installation and Setup

1.  **Clone the repository** and navigate to the `backend` directory using:
    ``` bash
    cd backend
    ```
2.  **Install dependencies**: 
    ```bash     
    npm install
    ```
3.  **Set up your environment variables**: Run the quickstart script to automatically create a `.env` file and be prompted for your Gemini API key: 
    ```bash     
    npm run quickstart
    ```

### Running the Application

-   **For development**, with automatic server restarts on file changes:

    ``` bash
    npm run dev
    ```

-   **For production**:

    ``` bash
    npm start
    ```

------------------------------------------------------------------------

## API Documentation

### **Start a Research Job**

-   **POST** `/api/research`
-   **Description**: Initiates a new research job.
-   **Request Body**:
    ```
    json     
    {       
        "query": "Your research query here"     
    }
    ```
-   **Response** (202 Accepted):
    ```
    json     
    {       
        "jobId": "a-unique-uuid",       
        "status": "queued",       
        "message": "Research job has been queued"     
    }
    ```

### **Check Job Status**

-   **GET** `/api/research/status/:jobId`
-   **Description**: Checks the status of a research job.
-   **Response** (200 OK):
    ```
    json     
    {       
        "jobId": "a-unique-uuid",       
        "status": "processing",       
        "progress": 50,       
        "createdAt": "2023-10-27T10:00:00.000Z",       
        "updatedAt": "2023-10-27T10:05:00.000Z"     
    }
    ```

### **Get Research Results**

-   **GET** `/api/research/results/:jobId`
-   **Description**: Retrieves the results of a completed job.
-   **Response** (200 OK): A JSON object containing the original query, expanded topics, a list of papers for each topic, and a detailed analysis.

------------------------------------------------------------------------

## Using the API with cURL

-   **Start a job**:

    ``` bash
    curl -X POST http://localhost:3000/api/research       
    -H "Content-Type: application/json"       
    -d '{"query": "The impact of AI on modern education"}'
    ```

-   **Check status**:

    ``` bash
    curl -X GET http://localhost:3000/api/research/status/your-job-id
    ```

-   **Get results**:

    ``` bash
    curl -X GET http://localhost:3000/api/research/results/your-job-id
    ```

------------------------------------------------------------------------

## Available Scripts

-   `npm run dev`: Starts the server in development mode.
-   `npm start`: Starts the server in production mode.
-   `npm run quickstart`: An interactive script to help with initial setup.
-   `npm run test-api`: A script to test the API endpoints.
-   `npm run test-redis`: Checks the connection to your Redis server.
-   `npm run setup`: Sets up Playwright.

------------------------------------------------------------------------

## Troubleshooting

### Debugging

To enable debug logs, you can set the `DEBUG` environment variable.

-   **PowerShell**:

    ``` powershell
    $env:DEBUG="researchai:*"
    ```

-   **Linux/macOS**:

    ``` bash
    export DEBUG="researchai:*"
    ```

You can also specify particular modules to debug, for example:
`export DEBUG="researchai:controller,researchai:gemini"`.

### Common Issues

-   **Redis Connection Errors**: If you encounter errors like
    `Redis connection to 127.0.0.1:6379 failed`, ensure that your Redis server is running and that the `REDIS_URL` in your `.env` file is correctly configured.

-   **Google Scholar Scraping**: If you run into CAPTCHA errors, you may need to try a different IP address (using a VPN or proxy), reduce how often you make requests, or change the user agent in `scholarScraperService.js`.
