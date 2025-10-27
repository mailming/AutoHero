# PowerShell script to copy API monitor logs from Downloads to project directory
# Run this script to automatically move API log files to the project folder

param(
    [string]$DownloadsPath = "$env:USERPROFILE\Downloads",
    [string]$ProjectPath = "C:\Users\USER\Workspace\AutoHero"
)

Write-Host "🔄 Copying API monitor logs from Downloads to project directory..." -ForegroundColor Green

# Create logs directory in project if it doesn't exist
$LogsDir = Join-Path $ProjectPath "api-logs"
if (!(Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force
    Write-Host "📁 Created logs directory: $LogsDir" -ForegroundColor Yellow
}

# Find and copy API log files
$ApiLogFiles = Get-ChildItem -Path $DownloadsPath -Filter "api-logs-*.json" -File | Sort-Object LastWriteTime -Descending

if ($ApiLogFiles.Count -eq 0) {
    Write-Host "❌ No API log files found in Downloads folder" -ForegroundColor Red
    Write-Host "   Looking for files matching pattern: api-logs-*.json" -ForegroundColor Gray
    exit
}

Write-Host "📋 Found $($ApiLogFiles.Count) API log files:" -ForegroundColor Cyan

foreach ($file in $ApiLogFiles) {
    $destination = Join-Path $LogsDir $file.Name
    
    # Check if file already exists in project directory
    if (Test-Path $destination) {
        Write-Host "⏭️  Skipping $($file.Name) - already exists in project" -ForegroundColor Yellow
        continue
    }
    
    try {
        Copy-Item $file.FullName $destination -Force
        Write-Host "✅ Copied: $($file.Name)" -ForegroundColor Green
        
        # Optionally remove from Downloads (uncomment next line if desired)
        # Remove-Item $file.FullName -Force
    }
    catch {
        Write-Host "❌ Failed to copy $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎯 API logs are now available in: $LogsDir" -ForegroundColor Green
Write-Host "📊 You can view them with any text editor or JSON viewer" -ForegroundColor Gray

# Show recent files
$RecentFiles = Get-ChildItem -Path $LogsDir -Filter "api-logs-*.json" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 5
if ($RecentFiles.Count -gt 0) {
    Write-Host "`n📄 Recent log files:" -ForegroundColor Cyan
    foreach ($file in $RecentFiles) {
        $size = [math]::Round($file.Length / 1KB, 2)
        Write-Host "   $($file.Name) ($size KB)" -ForegroundColor White
    }
}
