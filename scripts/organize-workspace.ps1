param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$rootPrefix = $projectRoot.TrimEnd('\') + '\'
function Assert-InProject([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path)
    if (-not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Path outside project: $full" }
    return $full
}
function Get-Sha([IO.Stream]$Stream) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($Stream)).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Get-FileSha([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    try { return Get-Sha $stream } finally { $stream.Dispose() }
}
$keepArtifacts = @('.gitkeep', 'workspace-cleanup', 'incoming-integration', 'game-package', 'player-no-age-build.log', 'player-no-age-browser.log', 'general-library-expansion-tests-2026-10-12.txt', 'general-library-expansion-typecheck-2026-10-12.txt')
$artifactPaths = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'artifacts') -Force | Where-Object { $_.Name -notin $keepArtifacts } | ForEach-Object { $_.FullName })
$deliveryPaths = @('current', 'archive', 'checkpoints' | ForEach-Object { Join-Path $projectRoot "deliverables/$_" } | Where-Object { Test-Path -LiteralPath $_ })
$groups = @(
    @{Name='historical-artifacts'; Paths=$artifactPaths},
    @{Name='historical-deliverables'; Paths=$deliveryPaths}
)
$tracked = @(& git -C $projectRoot ls-files)
if ($LASTEXITCODE -ne 0) { throw 'Cannot check tracked files' }
$records = @()
foreach ($group in $groups) {
    $files = @()
    foreach ($candidate in $group.Paths) {
        $candidate = Assert-InProject $candidate
        $items = @(Get-Item -LiteralPath $candidate -Force)
        if ($items[0].PSIsContainer) { $items += @(Get-ChildItem -LiteralPath $candidate -Recurse -Force) }
        foreach ($item in $items) {
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing linked path: $($item.FullName)" }
            if (-not $item.PSIsContainer) {
                $full = Assert-InProject $item.FullName
                $relative = $full.Substring($rootPrefix.Length).Replace('\', '/')
                if ($relative -in $tracked) { throw "Refusing tracked file: $relative" }
                $files += [pscustomobject]@{Path=$relative; Bytes=$item.Length; Sha256=(Get-FileSha $full)}
            }
        }
    }
    $records += [pscustomobject]@{Name=$group.Name; Files=$files; Bytes=($files | Measure-Object Bytes -Sum).Sum; Candidates=$group.Paths}
}
$records | Select-Object Name,@{n='Files';e={$_.Files.Count}},@{n='MB';e={[math]::Round($_.Bytes/1MB,2)}} | Format-Table -AutoSize
if (-not $Apply) { Write-Output 'Preview only. Use -Apply to archive, verify SHA-256, then remove archived originals.'; exit }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$historyRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetDirectoryName($projectRoot)) 'aetheria-history'))
$archiveRoot = [IO.Path]::GetFullPath((Join-Path $historyRoot ('workspace-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))))
if (-not $archiveRoot.StartsWith($historyRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid history archive path' }
$null = New-Item -ItemType Directory -Path $archiveRoot
foreach ($record in $records) {
    if (-not $record.Files.Count) { continue }
    $zipPath = Join-Path $archiveRoot ($record.Name + '.zip')
    $zip = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $record.Files) {
            $source = Assert-InProject (Join-Path $projectRoot $file.Path)
            $null = [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $source, $file.Path, [IO.Compression.CompressionLevel]::Optimal)
        }
    } finally { $zip.Dispose() }
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        if ($zip.Entries.Count -ne $record.Files.Count) { throw 'Archive file count mismatch' }
        foreach ($file in $record.Files) {
            $entry = $zip.GetEntry($file.Path)
            if (-not $entry -or $entry.Length -ne $file.Bytes) { throw "Archive entry mismatch: $($file.Path)" }
            $stream = $entry.Open()
            try { $actual = Get-Sha $stream } finally { $stream.Dispose() }
            if ($actual -ne $file.Sha256) { throw "Archive hash mismatch: $($file.Path)" }
        }
    } finally { $zip.Dispose() }
    # Recheck every original before removing any file from this group.
    foreach ($file in $record.Files) {
        $source = Assert-InProject (Join-Path $projectRoot $file.Path)
        if ((Get-FileSha $source) -ne $file.Sha256) { throw "File changed during archive: $($file.Path)" }
    }
    $record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $archiveRoot ($record.Name + '.manifest.json')) -Encoding UTF8
    foreach ($file in $record.Files) {
        $source = Assert-InProject (Join-Path $projectRoot $file.Path)
        Remove-Item -LiteralPath $source -Force
    }
    # Only empty directories are removed; new files created during cleanup are retained.
    foreach ($candidate in $record.Candidates) {
        $candidate = Assert-InProject $candidate
        if (Test-Path -LiteralPath $candidate -PathType Container) {
            $directories = @(Get-ChildItem -LiteralPath $candidate -Directory -Recurse -Force | Sort-Object { $_.FullName.Length } -Descending)
            $directories += Get-Item -LiteralPath $candidate
            foreach ($directory in $directories) {
                $target = Assert-InProject $directory.FullName
                if (-not @(Get-ChildItem -LiteralPath $target -Force).Count) { Remove-Item -LiteralPath $target -Force }
            }
        }
    }
    Write-Output "$($record.Name): archived and verified $($record.Files.Count) files"
}
Write-Output "Archive: $archiveRoot"
