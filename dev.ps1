# ============================================
# dev.ps1 — ยก backend (:4000) + frontend (:5173) พร้อมกัน [Windows]
# ============================================
#
#   .\dev.ps1       แล้วกด Ctrl+C ครั้งเดียวเพื่อปิดทั้งคู่
#
# ถ้ารันไม่ได้เพราะ execution policy (ครั้งแรกของเครื่อง):
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#
# คู่แฝดของ dev.sh (macOS/Linux) — ตรรกะเดียวกันเป๊ะ แก้ที่ไหนแก้อีกที่ด้วย
#
# ทำไมต้องเคลียร์ port ก่อนเริ่ม:
# `dotnet run` เป็นแค่ตัวห่อ — มันไปสตาร์ต bin\Debug\net8.0\ChangeRequest.API
# อีกที พอตัวห่อตาย ตัวจริงรอด กลายเป็น orphan ครอง port 4000 ค้างไว้
# รอบหน้ายกใหม่ bind ไม่ได้ แล้วเว็บก็ยังคุยกับตัวเก่า (ที่อ่าน .env ชุดเก่า)
# ต่อไปเรื่อยๆ — แก้ DB_HOST ใน .env เท่าไหร่ก็ไม่มีผล
# เลยต้องเคลียร์ด้วย "ใครถือ port นี้อยู่" แทน "ใครเป็นลูกของ script"

$BackendPort  = 4000   # backend/.env: PORT=4000
$FrontendPort = 5173   # vite default — ตรงกับ CORS ใน backend/Program.cs

# คืน PID ของ process ที่ LISTEN อยู่บน port นี้ (ว่าง = ไม่มีใครถือ)
function Get-PortOwner {
    param([int]$Port)

    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        return @(
            Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty OwningProcess -Unique
        )
    }

    # Windows เก่าที่ไม่มี Get-NetTCPConnection — อ่านจาก netstat แทน
    # (คอลัมน์สุดท้ายของบรรทัด LISTENING คือ PID)
    return @(
        netstat -ano |
            Select-String ":$Port\s" |
            Select-String 'LISTENING' |
            ForEach-Object { ($_.ToString().Trim() -split '\s+')[-1] } |
            Sort-Object -Unique
    )
}

# ฆ่าใครก็ตามที่ถือ port นี้อยู่ (รวม orphan จากรอบก่อน)
function Clear-Port {
    param([int]$Port)

    $owners = Get-PortOwner -Port $Port
    if (-not $owners) { return }

    Write-Host "dev.ps1: port $Port ถูกจองอยู่ (PID $($owners -join ', ')) — ปิดก่อน"
    foreach ($owner in $owners) {
        Stop-Process -Id $owner -ErrorAction SilentlyContinue
    }

    # รอปิดตัวเองแบบสุภาพก่อน 10 วิ
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        $owners = Get-PortOwner -Port $Port
        if (-not $owners) { return }
    }

    Write-Host "dev.ps1: PID $($owners -join ', ') ไม่ยอมตาย — บังคับปิด"
    foreach ($owner in $owners) {
        Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

$backend  = $null
$frontend = $null

try {
    # เคลียร์ของค้างจากรอบก่อนก่อนเริ่ม
    Clear-Port -Port $BackendPort
    Clear-Port -Port $FrontendPort

    Write-Host "dev.ps1: backend  http://localhost:$BackendPort/api"
    Write-Host "dev.ps1: frontend http://localhost:$FrontendPort"
    Write-Host ''

    # npm บน Windows คือ npm.cmd — เรียก 'npm' เฉยๆ Start-Process หาไม่เจอ
    $npm = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { 'npm.cmd' } else { 'npm' }

    $backend = Start-Process -FilePath 'dotnet' -ArgumentList 'run' `
        -WorkingDirectory (Join-Path $PSScriptRoot 'backend') -NoNewWindow -PassThru

    $frontend = Start-Process -FilePath $npm -ArgumentList 'run', 'dev' `
        -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') -NoNewWindow -PassThru

    Wait-Process -Id $backend.Id, $frontend.Id
}
finally {
    # ทำงานทั้งตอน Ctrl+C และตอนจบเอง
    Write-Host ''
    Write-Host 'dev.ps1: ปิด backend + frontend'

    foreach ($proc in @($backend, $frontend)) {
        if ($proc -and -not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }

    Clear-Port -Port $BackendPort    # เก็บ orphan ที่ตัวห่อทิ้งไว้
    Clear-Port -Port $FrontendPort
}
