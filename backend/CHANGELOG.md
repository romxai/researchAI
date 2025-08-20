# Changelog

## Bug Fixes and Improvements

### Fixed Issues

- Fixed Bull queue initialization issue by importing Bull correctly and configuring Redis connection
- Added proper error handling for Redis connection failures
- Enhanced PDF processing with better error handling and validation
- Improved Google Scholar scraping with more robust error handling and timeouts
- Added checks for empty search results and missing data

### Added Features

- Comprehensive debug logging throughout the codebase using the debug package
- Redis connection test script to verify Redis is running properly
- Enhanced error messages with more context and details
- Added Redis configuration options in env.example
- Added Redis installation instructions to README
- Added troubleshooting section to README
- Added Redis connection check to startup script

### Code Quality Improvements

- Better error handling with try/catch blocks in critical sections
- Added validation for API responses and data processing
- Improved logging for easier debugging
- Added more detailed documentation
- Enhanced PDF content validation before parsing

## How to Use Debug Logging

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

## Redis Setup

Redis is now required for the job queue to work properly. To test your Redis connection:

```
npm run test-redis
```

See the README.md for Redis installation instructions.
