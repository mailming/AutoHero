# API Monitor Logging System

## 📁 **File Locations**

### **Downloads Folder (Default)**
- **Location**: `C:\Users\USER\Downloads\`
- **Files**: `AutoHero-API-Logs-*.json`, `AutoHero-Test-*.json`
- **Why**: Tampermonkey security restrictions

### **Project Directory (After Copy)**
- **Location**: `C:\Users\USER\Workspace\AutoHero\api-logs\`
- **Files**: Same files copied from Downloads
- **How**: Use the copy scripts below

## 🔄 **How to Copy Logs to Project Directory**

### **Method 1: PowerShell Script (Recommended)**
```powershell
# Run from project directory
.\copy-api-logs.ps1
```

### **Method 2: Batch File**
```cmd
# Double-click or run from command prompt
copy-logs.bat
```

### **Method 3: Manual Copy**
1. Open Downloads folder: `C:\Users\USER\Downloads\`
2. Find files starting with `AutoHero-API-Logs-`
3. Copy them to: `C:\Users\USER\Workspace\AutoHero\api-logs\`

## 📊 **Log File Formats**

### **JSON Format (Default)**
```json
{
  "requests": [...],
  "responses": [...],
  "errors": [...],
  "metadata": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "totalRequests": 5,
    "totalResponses": 5,
    "totalErrors": 0
  }
}
```

### **Text Format**
```
=== API MONITOR LOGS ===
Timestamp: 2024-01-01T12:00:00.000Z
Total Requests: 5
Total Responses: 5
Total Errors: 0

--- REQUESTS ---
[Request details...]

--- RESPONSES ---
[Response details...]
```

### **CSV Format**
```
Type,Timestamp,Method,URL,Status,Size
request,2024-01-01T12:00:00.000Z,GET,https://api.example.com/data,200,1024
response,2024-01-01T12:00:01.000Z,GET,https://api.example.com/data,200,1024
```

## ⚙️ **Configuration**

Edit `api-monitor.user.js` to change settings:

```javascript
const CONFIG = {
    enableFileLogging: true,        // Enable/disable file logging
    logToFileInterval: 3000,        // Write logs every 3 seconds
    maxLogFileSize: 10 * 1024 * 1024, // 10MB max file size
    logFormat: 'json'               // 'json', 'text', 'csv'
};
```

## 🎯 **Usage Workflow**

1. **Install script** in Tampermonkey
2. **Browse websites** - API calls are automatically captured
3. **Logs are written** to Downloads folder every 3 seconds
4. **Run copy script** to move logs to project directory
5. **Analyze logs** using any text editor or JSON viewer

## 🔍 **Troubleshooting**

### **No Files Created**
- Check console for errors
- Verify Tampermonkey permissions
- Ensure `GM_download` grant is enabled

### **Files Not Copying**
- Check PowerShell execution policy
- Verify file paths exist
- Run as administrator if needed

### **Empty Log Files**
- Check if API requests are being intercepted
- Verify website is making API calls
- Test with the built-in test requests
