$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskReport = Get-Content -LiteralPath (Join-Path $taskRoot 'artifacts/remaining-work-package/latest.json') -Raw | ConvertFrom-Json
$taskInput = [System.IO.Path]::GetFullPath((Join-Path $taskRoot $taskReport.folder))
$taskOutput = $taskInput + '-轻量版'
$taskArchive = $taskOutput + '.zip'
foreach ($taskTarget in @($taskInput, $taskOutput, $taskArchive)) {
    if (-not $taskTarget.StartsWith(($taskRoot + '\'), [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Output outside workspace' }
}
if (Test-Path -LiteralPath $taskArchive) { throw 'Light archive already exists; preserve it rather than overwrite' }
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$taskManifest = Get-Content -LiteralPath (Join-Path $taskInput 'PACKAGE-MANIFEST.json') -Raw | ConvertFrom-Json
$taskRows = @()
foreach ($taskRow in $taskManifest.files) {
    if ($taskRow.file -notmatch '^(01-|02-|03-|04-|05-)' -and $taskRow.file -ne 'BASELINE.json') { continue }
    $taskFrom = [System.IO.Path]::GetFullPath((Join-Path $taskInput $taskRow.file))
    $taskTo = [System.IO.Path]::GetFullPath((Join-Path $taskOutput $taskRow.file))
    if (-not $taskFrom.StartsWith(($taskInput + '\'), [System.StringComparison]::OrdinalIgnoreCase) -or -not $taskTo.StartsWith(($taskOutput + '\'), [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid manifest path' }
    if ((Get-FileHash -LiteralPath $taskFrom -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskRow.sha256) { throw 'Original changed: ' + $taskRow.file }
    New-Item -ItemType Directory -Path ([System.IO.Path]::GetDirectoryName($taskTo)) -Force | Out-Null
    Copy-Item -LiteralPath $taskFrom -Destination $taskTo
    if ($taskRow.file -match '/ENG-[^/]+\.md$') {
        $taskText = [System.IO.File]::ReadAllText($taskTo).Replace('解压随附源码', '读取仓库或另行解压共享源码附件')
        [System.IO.File]::WriteAllText($taskTo, $taskText, [System.Text.UTF8Encoding]::new($false))
    }
    $taskRows += [ordered]@{file=$taskRow.file; sha256=(Get-FileHash -LiteralPath $taskTo -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$taskGuide = @'
# 轻量任务包

保留全部30份任务书及必要的作者格式。完整源码独立提供；每个工程包中的重复源码和24份重复校验工具已移出本包。

- 写文案：只发对应 CONTENT-*.md 或 B1/B2-题材.md；B任务书已经内嵌所需规范和Schema。JSON格式示意与对应写作任务一起发。
- 改代码且能读仓库：只发对应 ENG-*.md，并要求按BASELINE.json的commit检查源码。
- 改代码且不能读仓库：发对应 ENG-*.md，再另附共享“源码-eca297ae.zip”。源码只需下载一次。
- 需要离线校验：原总包目录的“单独发包/B1-题材.zip”或“B2-题材.zip”每份约192KB，自带工具；不必发61MB总包。

内容任务可以并行，工程任务按任务书的接口依赖收回补丁统一合入。已完成A54、B945、首批服务及性格交谈，不重复开发。收稿不等于实装，实际测试由接手方运行并如实报告。

先读任务要求，再交JSON/补丁和说明；不需要把本包全部内容放进同一个AI聊天。
'@
[System.IO.File]::WriteAllText((Join-Path $taskOutput '00-怎么发.md'), $taskGuide, [System.Text.UTF8Encoding]::new($false))
$taskRows += [ordered]@{file='00-怎么发.md';sha256=(Get-FileHash -LiteralPath (Join-Path $taskOutput '00-怎么发.md') -Algorithm SHA256).Hash.ToLowerInvariant()}
$taskLightManifest = [ordered]@{sourceCommit=$taskReport.sourceCommit; taskCount=30; sourceSeparate=$true; sourceArchive=(Join-Path $taskInput '工程附件/源码-eca297ae.zip'); files=$taskRows}
[System.IO.File]::WriteAllText((Join-Path $taskOutput 'PACKAGE-MANIFEST.json'), ($taskLightManifest | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($taskOutput, $taskArchive, [System.IO.Compression.CompressionLevel]::Optimal, $false)
$taskZip = [System.IO.Compression.ZipFile]::OpenRead($taskArchive)
try {
    foreach ($taskEntry in $taskZip.Entries) {
        $taskEntryPath = $taskEntry.FullName.Replace('\', '/')
        if ($taskEntryPath.EndsWith('/')) { continue }
        $taskExpected = [System.IO.File]::ReadAllBytes((Join-Path $taskOutput $taskEntryPath))
        $taskStream = $taskEntry.Open()
        $taskBuffer = [System.IO.MemoryStream]::new()
        try { $taskStream.CopyTo($taskBuffer); $taskActual = $taskBuffer.ToArray() } finally { $taskStream.Dispose(); $taskBuffer.Dispose() }
        $taskHasher = [System.Security.Cryptography.SHA256]::Create()
        try {
            if ([Convert]::ToBase64String($taskHasher.ComputeHash($taskExpected)) -ne [Convert]::ToBase64String($taskHasher.ComputeHash($taskActual))) { throw 'Archive mismatch: ' + $taskEntryPath }
        } finally { $taskHasher.Dispose() }
    }
    $taskCount = $taskZip.Entries.Count
} finally { $taskZip.Dispose() }
$taskResult = [ordered]@{archive=$taskArchive; bytes=(Get-Item -LiteralPath $taskArchive).Length; files=$taskCount; tasks=30; allEntriesReadBack=$true; sha256=(Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant()}
$taskResult | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'artifacts/remaining-work-package/light.json') -Encoding utf8
$taskResult | ConvertTo-Json
