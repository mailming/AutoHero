# Hero Wars API Monitor

A comprehensive Tampermonkey script for monitoring API calls, responses, and errors in web applications, specifically designed for Hero Wars and other Nexters Global games.

## Features

- **Complete API Monitoring**: Captures all fetch() and XMLHttpRequest calls
- **Real-time Statistics**: Live stats display showing request/response counts
- **Data Export**: Export captured data as JSON or HAR format
- **Error Tracking**: Monitors and logs API errors with stack traces
- **UI Controls**: Built-in interface for viewing and managing captured data
- **Auto-save**: Automatically saves data every 30 seconds
- **Response Body Capture**: Captures response bodies with smart content type handling
- **Memory Management**: Limits stored data to prevent memory issues
- **🆕 File Logging**: Automatically logs all API calls and responses to files
- **🆕 Multiple Log Formats**: Support for JSON, text, and CSV log formats
- **🆕 Automatic File Downloads**: Logs are automatically downloaded as files

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Open Tampermonkey dashboard
3. Click "Create a new script"
4. Copy the contents of `api-monitor.user.js` into the editor
5. Save the script (Ctrl+S)
6. Navigate to any website to start monitoring

## Usage

### Automatic Monitoring
The script automatically starts monitoring when you visit any website. You'll see:
- A stats panel in the top-right corner
- Control buttons in the top-left corner
- Console logs for all API activity

### Manual Commands
Use these commands in the browser console:

```javascript
// View all captured data in a popup window
window.apiMonitor.showData()

// Clear all captured data
window.apiMonitor.clearData()

// Export data as JSON file
window.apiMonitor.exportData('json')

// Export data as HAR file (for use with browser dev tools)
window.apiMonitor.exportData('har')

// Get raw data object
window.apiMonitor.getAllData()

// 🆕 File Logging Commands
// Force write logs to file immediately
window.apiMonitor.forceWriteLogs()

// Get logging statistics
window.apiMonitor.getLogStats()
```

### Configuration
Modify the CONFIG object in the script to customize behavior:

```javascript
const CONFIG = {
    maxRequests: 1000,        // Maximum requests to store
    maxResponseSize: 1024 * 1024, // Max response body size (1MB)
    enableUI: true,           // Show UI controls
    enableExport: true,       // Enable export functionality
    enableFiltering: true,    // Enable request filtering
    logLevel: 'all',          // 'all', 'errors', 'requests', 'responses'
    enableFileLogging: true,  // Enable automatic file logging
    logToFileInterval: 5000,  // Log to file every 5 seconds
    maxLogFileSize: 10 * 1024 * 1024, // 10MB max log file size
    logFormat: 'json'         // 'json', 'text', 'csv'
};
```

## Captured Data Structure

### Request Object
```javascript
{
    id: "unique_request_id",
    type: "fetch" | "xhr",
    url: "https://api.example.com/endpoint",
    method: "GET" | "POST" | "PUT" | "DELETE",
    headers: { "Content-Type": "application/json" },
    body: request_payload,
    timestamp: "2024-01-01T12:00:00.000Z"
}
```

### Response Object
```javascript
{
    requestId: "matching_request_id",
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "application/json" },
    body: response_data,
    timestamp: "2024-01-01T12:00:01.000Z"
}
```

### Error Object
```javascript
{
    requestId: "matching_request_id",
    error: "Error message",
    stack: "Error stack trace",
    timestamp: "2024-01-01T12:00:01.000Z"
}
```

## Hero Wars Specific Features

The script is optimized for Hero Wars API monitoring with:
- Special handling for Nexters Global API endpoints
- Authentication header tracking
- Session management monitoring
- Battle API call tracking

## File Logging

### Automatic File Logging
The script automatically logs all API calls and responses to files:

- **Automatic Downloads**: Files are automatically downloaded to your default download folder
- **Multiple Formats**: Support for JSON, text, and CSV formats
- **Configurable Interval**: Set how often logs are written (default: every 5 seconds)
- **File Naming**: Files are named with timestamps (e.g., `api-logs-2024-01-01T12-00-00-000Z.json`)

### Log Formats

#### JSON Format (Default)
```json
{
  "session": {
    "url": "https://heroes-wb.nextersglobal.com/",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "logsCount": 5
  },
  "logs": [
    {
      "type": "request",
      "data": { /* request data */ },
      "timestamp": "2024-01-01T12:00:00.000Z"
    },
    {
      "type": "response", 
      "data": { /* response data */ },
      "timestamp": "2024-01-01T12:00:01.000Z"
    }
  ]
}
```

#### Text Format
```
[2024-01-01T12:00:00.000Z] REQUEST: {
  "id": "1234567890",
  "type": "fetch",
  "url": "https://api.example.com/endpoint",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": { "key": "value" },
  "timestamp": "2024-01-01T12:00:00.000Z"
}

[2024-01-01T12:00:01.000Z] RESPONSE: {
  "requestId": "1234567890",
  "status": 200,
  "statusText": "OK",
  "headers": { "Content-Type": "application/json" },
  "body": { "success": true },
  "timestamp": "2024-01-01T12:00:01.000Z"
}
```

#### CSV Format
```csv
timestamp,type,url,method,status,error
2024-01-01T12:00:00.000Z,request,https://api.example.com/endpoint,POST,,
2024-01-01T12:00:01.000Z,response,https://api.example.com/endpoint,,200,
2024-01-01T12:00:02.000Z,error,https://api.example.com/endpoint,,,Network Error
```

## Export Formats

### JSON Export
Contains all captured data in a structured format suitable for analysis.

### HAR Export
Creates a HAR (HTTP Archive) file compatible with:
- Chrome DevTools
- Postman
- Other HTTP analysis tools

## Troubleshooting

### Script Not Working
1. Check if Tampermonkey is enabled
2. Verify the script is active for the current domain
3. Check browser console for errors
4. Ensure the website allows script execution

### Missing API Calls
1. Some APIs might use WebSockets (not captured by this script)
2. Check if the website uses Service Workers
3. Verify the script is running on the correct domain

### Performance Issues
1. Reduce `maxRequests` in CONFIG
2. Reduce `maxResponseSize` in CONFIG
3. Disable UI with `enableUI: false`

## Development

### Adding New Features
The script is modular and easy to extend. Key areas for modification:
- `CONFIG` object for configuration
- `window.apiMonitor` object for core functionality
- Interceptor functions for fetch/XHR monitoring
- UI functions for interface management

### Testing
Test the script on various websites to ensure compatibility:
- Hero Wars (primary target)
- Other Nexters Global games
- General web applications

## License

This script is part of the AutoHero project and is intended for educational and development purposes.

## Contributing

To contribute to this script:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Changelog

### Version 2.1
- **🆕 File Logging**: Added automatic file logging functionality
- **🆕 Multiple Log Formats**: Support for JSON, text, and CSV formats
- **🆕 Automatic Downloads**: Logs are automatically downloaded as files
- **🆕 Configurable Logging**: Customizable logging intervals and formats
- **🆕 Log Statistics**: Track logging performance and statistics
- **🆕 Enhanced UI**: Added file logging controls and status display
- **🆕 Force Logging**: Manual trigger for immediate log file creation

### Version 2.0
- Complete rewrite with enhanced features
- Added HAR export functionality
- Improved UI with real-time stats
- Better error handling and logging
- Auto-save functionality
- Memory management improvements

### Version 1.0
- Initial release with basic API monitoring
- JSON export functionality
- Console logging
