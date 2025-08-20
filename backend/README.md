# Research Assistant API

Backend service for the Research Assistant application that processes research queries, scrapes Google Scholar, and generates academic-style research guides using Gemini AI.

## Setup

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Google Gemini API key
- Redis (required for job queue)

#### Redis Installation

**Windows:**

1. Download and install Redis for Windows from [https://github.com/microsoftarchive/redis/releases](https://github.com/microsoftarchive/redis/releases)
2. Or use WSL2 to install Redis using the Linux instructions
3. Alternatively, use Docker: `docker run --name redis -p 6379:6379 -d redis`

**macOS:**

```
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian):**

```
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

To verify Redis is running:

```
redis-cli ping
```

Should return `PONG`

### Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```
   cd backend
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Create a `.env` file in the root directory with the following content:
   ```
   PORT=3000
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

### Running the Application

Quick start (recommended for first-time setup):

```
npm run quickstart
```

This will:

1. Create a `.env` file if it doesn't exist
2. Prompt you for your Gemini API key
3. Start the server in development mode

Development mode:

```
npm run dev
```

Production mode:

```
npm start
```

## API Documentation

### Start a Research Job

Initiates a new research job based on the user's query.

- **URL**: `/api/research`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "query": "Your research query here"
  }
  ```
- **Success Response**:
  - **Code**: 202 Accepted
  - **Content**:
    ```json
    {
      "jobId": "uuid-here",
      "status": "queued",
      "message": "Research job has been queued"
    }
    ```
- **Error Response**:
  - **Code**: 400 Bad Request
  - **Content**:
    ```json
    {
      "error": true,
      "message": "Query is required"
    }
    ```

### Check Job Status

Checks the status of a research job.

- **URL**: `/api/research/status/:jobId`
- **Method**: `GET`
- **URL Parameters**: `jobId=[uuid]`
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "jobId": "uuid-here",
      "status": "processing", // can be "queued", "processing", "completed", or "failed"
      "progress": 70, // percentage complete (0-100)
      "createdAt": "2023-08-20T12:34:56.789Z",
      "updatedAt": "2023-08-20T12:35:56.789Z"
    }
    ```
- **Error Response**:
  - **Code**: 404 Not Found
  - **Content**:
    ```json
    {
      "error": true,
      "message": "Job not found"
    }
    ```

### Get Research Results

Retrieves the results of a completed research job.

- **URL**: `/api/research/results/:jobId`
- **Method**: `GET`
- **URL Parameters**: `jobId=[uuid]`
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "query": "Original query",
      "expandedTopics": ["Topic 1", "Topic 2", "Topic 3"],
      "papersByTopic": {
        "Topic 1": [
          {
            "title": "Paper Title",
            "authors": "Author Names",
            "year": "2023",
            "publication": "Journal Name",
            "abstract": "Paper abstract...",
            "url": "https://paper-url.com",
            "pdfUrl": "https://paper-pdf-url.com",
            "citationCount": 42,
            "citation": "APA formatted citation",
            "fullText": "Full text of the paper if available..."
          }
          // More papers...
        ]
        // More topics...
      },
      "analysis": {
        "summary": "Overall research summary...",
        "keyFindings": [
          {
            "topic": "Topic name",
            "findings": "Key findings for this topic..."
          }
          // More topics...
        ],
        "methodologies": {
          "common": ["Method 1", "Method 2"],
          "emerging": ["New method 1", "New method 2"]
        },
        "researchGaps": ["Gap 1 description", "Gap 2 description"],
        "futureDirections": ["Future direction 1", "Future direction 2"],
        "keyPapers": [
          {
            "title": "Paper title",
            "authors": "Author names",
            "year": "Publication year",
            "summary": "Brief summary of importance",
            "citation": "Full citation in APA format"
          }
          // More key papers...
        ],
        "comparativeAnalysis": "Analysis comparing different approaches..."
      }
    }
    ```
- **Error Response**:
  - **Code**: 404 Not Found
  - **Content**:
    ```json
    {
      "error": true,
      "message": "Job not found"
    }
    ```
  - **OR**
  - **Code**: 400 Bad Request
  - **Content**:
    ```json
    {
      "error": true,
      "message": "Job is not completed yet. Current status: processing"
    }
    ```

## Example Usage with cURL

### Start a research job:

```bash
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"query": "Machine learning applications in climate change"}'
```

### Check job status:

```bash
curl -X GET http://localhost:3000/api/research/status/your-job-id-here
```

### Get research results:

```bash
curl -X GET http://localhost:3000/api/research/results/your-job-id-here
```

## Error Handling

The API uses standard HTTP status codes to indicate success or failure:

- `200`: OK - The request was successful
- `202`: Accepted - The request has been accepted for processing
- `400`: Bad Request - The request was invalid
- `404`: Not Found - The requested resource was not found
- `500`: Internal Server Error - An error occurred on the server

## Limitations

- Google Scholar scraping may be blocked if too many requests are made from the same IP address
- Only freely available PDFs can be downloaded and processed
- The Gemini API has rate limits that may affect processing time

## Troubleshooting

### Redis Connection Issues

If you see errors like `Error: Redis connection to 127.0.0.1:6379 failed`, make sure:

1. Redis server is running
2. The port is not blocked by a firewall
3. The REDIS_URL in your .env file is correct

### Google Scholar Scraping Issues

If you encounter CAPTCHA errors:

1. Try using a different IP address (VPN or proxy)
2. Reduce the frequency of requests
3. Modify the user agent in scholarScraperService.js

### Debugging

To enable debug logs, set the DEBUG environment variable:

```
# Windows PowerShell
$env:DEBUG="researchai:*"

# Linux/macOS
export DEBUG="researchai:*"
```

You can also enable specific debug namespaces:

```
# Only controller and Gemini API logs
export DEBUG="researchai:controller,researchai:gemini"

# Only Google Scholar scraper logs
export DEBUG="researchai:scholar"
```
