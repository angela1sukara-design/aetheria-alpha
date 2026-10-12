param([ValidateSet('Plan','Apply','Verify','Undo')][string]$Mode = 'Plan')
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$recordRelative = 'deliverables/organization-2026-10-11.json'
function Resolve-WorkspacePath([string]$relative) {
  $resolved = [IO.Path]::GetFullPath((Join-Path $taskRoot $relative))
  if (-not $resolved.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Path outside workspace: $relative" }
  return $resolved
}
function Get-Inventory([string]$relative) {
  $target = Resolve-WorkspacePath $relative
  $item = Get-Item -LiteralPath $target -Force
  $entries = @($item)
  if ($item.PSIsContainer) { $entries += @(Get-ChildItem -LiteralPath $target -Recurse -Force) }
  $result = foreach ($entry in $entries) {
    if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked path requires manual review: $($entry.FullName)" }
    $suffix = $entry.FullName.Substring($target.Length).Replace('\','/')
    if ($entry.PSIsContainer) { [pscustomobject]@{ path=$suffix; kind='directory' } }
    else { [pscustomobject]@{ path=$suffix; kind='file'; bytes=$entry.Length; sha256=(Get-FileHash -LiteralPath $entry.FullName -Algorithm SHA256).Hash } }
  }
  return @($result | Sort-Object path)
}
function Assert-Inventory($entry, [string]$relative) {
  $actual = ConvertTo-Json -InputObject @(Get-Inventory $relative) -Depth 8 -Compress
  $expected = ConvertTo-Json -InputObject @($entry.inventory) -Depth 8 -Compress
  if ($actual -cne $expected) { throw "Inventory mismatch: $relative. No overwrite or deletion performed." }
}
$moves = @(
  @('Aetheria-WorldGenerator-v0.2','deliverables/archive/worldgen-v0.2/Aetheria-WorldGenerator-v0.2'),
  @('deliverables/Aetheria-WorldGenerator-v0.2.zip','deliverables/archive/worldgen-v0.2/Aetheria-WorldGenerator-v0.2.zip'),
  @('deliverables/WorldGenerator-v0.2-baseline.zip','deliverables/archive/worldgen-v0.2/WorldGenerator-v0.2-baseline.zip'),
  @('deliverables/WorldGenerator-v0.2-M1-build.zip','deliverables/archive/worldgen-v0.2/WorldGenerator-v0.2-M1-build.zip'),
  @('deliverables/WorldGenerator-v0.1.zip','deliverables/archive/worldgen-v0.1/WorldGenerator-v0.1.zip'),
  @('deliverables/WorldGenerator-M1.zip','deliverables/archive/worldgen-v0.1/WorldGenerator-M1.zip'),
  @('deliverables/WorldGenerator-v0.1-evidence','deliverables/archive/worldgen-v0.1/WorldGenerator-v0.1-evidence'),
  @('deliverables/alpha02-release','deliverables/archive/alpha02/alpha02-release'),
  @('deliverables/alpha02-base.zip','deliverables/archive/alpha02/alpha02-base.zip'),
  @('deliverables/Alpha02-A.zip','deliverables/archive/alpha02/Alpha02-A.zip'),
  @('deliverables/Alpha02-B.zip','deliverables/archive/alpha02/Alpha02-B.zip'),
  @('deliverables/Alpha02-C.zip','deliverables/archive/alpha02/Alpha02-C.zip'),
  @('deliverables/Alpha02-pre-worldgen.zip','deliverables/archive/alpha02/Alpha02-pre-worldgen.zip'),
  @('deliverables/alpha02-checkpoint.bundle','deliverables/checkpoints/alpha02-checkpoint.bundle'),
  @('deliverables/Lexicon-Authoring-v0.1.zip','deliverables/tools/Lexicon-Authoring-v0.1.zip'),
  @('deliverables/Lexicon-Authoring-v0.2.zip','deliverables/tools/Lexicon-Authoring-v0.2.zip'),
  @('deliverables/Text-Slot-Integration-v0.1.zip','deliverables/tools/Text-Slot-Integration-v0.1.zip'),
  @('deliverables/Aetheria-WorldGenerator-v0.2.1-Lexicon','deliverables/current/Aetheria-WorldGenerator-v0.2.1-Lexicon'),
  @('deliverables/Aetheria-WorldGenerator-v0.2.1-Lexicon.zip','deliverables/current/Aetheria-WorldGenerator-v0.2.1-Lexicon.zip'),
  @('deliverables/Aetheria-WorldGenerator-v0.2.1-Lexicon.release.json','deliverables/current/Aetheria-WorldGenerator-v0.2.1-Lexicon.release.json'),
  @('deliverables/Aetheria-Alpha-0.2-Source.zip','deliverables/current/Aetheria-Alpha-0.2-Source.zip'),
  @('deliverables/Aetheria-Alpha-0.2.html','deliverables/current/Aetheria-Alpha-0.2.html'),
  @('deliverables/Alpha02-SHA256.json','deliverables/current/Alpha02-SHA256.json')
)
$recordPath = Resolve-WorkspacePath $recordRelative
if ($Mode -eq 'Plan') {
  $moves | ForEach-Object { [pscustomobject]@{ from=$_[0]; to=$_[1]; exists=(Test-Path -LiteralPath (Resolve-WorkspacePath $_[0])) } } | Format-Table -AutoSize
  exit
}
if ($Mode -eq 'Apply') {
  if (Test-Path -LiteralPath $recordPath) { throw 'Organization record already exists. Use Verify or Undo.' }
  # Validate every source and destination before the first move; preserve nested Git repositories.
  foreach ($move in $moves) {
    if (-not (Test-Path -LiteralPath (Resolve-WorkspacePath $move[0]))) { throw "Missing source: $($move[0])" }
    if (Test-Path -LiteralPath (Resolve-WorkspacePath $move[1])) { throw "Destination exists: $($move[1])" }
  }
  $entries = @($moves | ForEach-Object { [pscustomobject]@{ from=$_[0]; to=$_[1]; inventory=@(Get-Inventory $_[0]) } })
  $record = [pscustomobject]@{ format='aetheria-workspace-organization'; date='2026-10-11'; moves=$entries }
  $record | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $recordPath -Encoding utf8
  foreach ($entry in $entries) {
    $destination = Resolve-WorkspacePath $entry.to
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Move-Item -LiteralPath (Resolve-WorkspacePath $entry.from) -Destination $destination
    Assert-Inventory $entry $entry.to
    Write-Output "Verified move: $($entry.from) -> $($entry.to)"
  }
  Write-Output "Completed $($entries.Count) moves; SHA-256, sizes, names and empty directories preserved."
  exit
}
if (-not (Test-Path -LiteralPath $recordPath)) { throw 'No organization record found.' }
$record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
if ($record.format -ne 'aetheria-workspace-organization') { throw 'Unsupported record format.' }
if ($Mode -eq 'Verify') {
  foreach ($entry in $record.moves) {
    if (Test-Path -LiteralPath (Resolve-WorkspacePath $entry.from)) { throw "Original path has reappeared: $($entry.from)" }
    Assert-Inventory $entry $entry.to
  }
  Write-Output "Verified all $($record.moves.Count) moves against the original inventories."
  exit
}
# Preflight the entire rollback; changed archives or occupied paths must be reviewed first.
foreach ($entry in $record.moves) {
  $source = Resolve-WorkspacePath $entry.from
  $destination = Resolve-WorkspacePath $entry.to
  if (Test-Path -LiteralPath $source) {
    if (Test-Path -LiteralPath $destination) { throw "Undo would overwrite an existing path: $($entry.from)" }
    Assert-Inventory $entry $entry.from
  } else { Assert-Inventory $entry $entry.to }
}
$reverse = @($record.moves)
[array]::Reverse($reverse)
foreach ($entry in $reverse) {
  $original = Resolve-WorkspacePath $entry.from
  if (-not (Test-Path -LiteralPath $original)) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $original) | Out-Null
    Move-Item -LiteralPath (Resolve-WorkspacePath $entry.to) -Destination $original
    Assert-Inventory $entry $entry.from
  }
}
Write-Output 'Original file locations restored. Documentation, record and empty grouping directories are retained.'
