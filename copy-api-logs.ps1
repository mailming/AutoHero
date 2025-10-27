# PowerShell script to copy API monitor logs from Downloads to project directory
param(
    [string]$DownloadsPath = "$env:USERPROFILE\Downloads",
    [string]$ProjectPath = "C:\Users\USER\Workspace\AutoHero"
)

Write-Host "Copying API monitor logs from Downloads to project directory..." -ForegroundColor Green

# Create logs directory in project if it doesn't exist
$LogsDir = Join-Path $ProjectPath "api-logs"
if (!(Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force
    Write-Host "Created logs directory: $LogsDir" -ForegroundColor Yellow
}

# Find and copy API log files
$ApiLogFiles = Get-ChildItem -Path $DownloadsPath -Filter "AutoHero-*.json" -File | Sort-Object LastWriteTime -Descending

if ($ApiLogFiles.Count -eq 0) {
    Write-Host "No API log files found in Downloads folder" -ForegroundColor Red
    Write-Host "Looking for files matching pattern: AutoHero-*.json" -ForegroundColor Gray
    exit
}

Write-Host "Found $($ApiLogFiles.Count) API log files:" -ForegroundColor Cyan

foreach ($file in $ApiLogFiles) {
    $destination = Join-Path $LogsDir $file.Name
    
    # Check if file already exists in project directory
    if (Test-Path $destination) {
        Write-Host "Skipping $($file.Name) - already exists in project" -ForegroundColor Yellow
        continue
    }
    
    try {
        Copy-Item $file.FullName $destination -Force
        Write-Host "Copied: $($file.Name)" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to copy $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nAPI logs are now available in: $LogsDir" -ForegroundColor Green
Write-Host "You can view them with any text editor or JSON viewer" -ForegroundColor Gray

# Show recent files
$RecentFiles = Get-ChildItem -Path $LogsDir -Filter "AutoHero-*.json" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 5
if ($RecentFiles.Count -gt 0) {
    Write-Host "`nRecent log files:" -ForegroundColor Cyan
    foreach ($file in $RecentFiles) {
        $sizeKB = [math]::Round($file.Length / 1024, 2)
        Write-Host "  $($file.Name) - $sizeKB KB" -ForegroundColor White
    }
}