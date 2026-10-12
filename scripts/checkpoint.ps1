param([Parameter(Mandatory=$true)][string]$Stage)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$target = Join-Path $taskRoot ('deliverables\archive\alpha02\Alpha02-' + $Stage + '.zip')
if (-not $target.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid archive target' }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
$entries = @('src','content','scripts','tests','docs','dist','production','index.html','package.json','package-lock.json','tsconfig.json','start_game.bat','README.md','项目导航.md') | ForEach-Object { Join-Path $taskRoot $_ } | Where-Object { Test-Path -LiteralPath $_ }
Compress-Archive -LiteralPath $entries -DestinationPath $target -Force
Write-Output $target
