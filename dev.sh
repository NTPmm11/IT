#!/usr/bin/env bash
# ============================================
# dev.sh — ยก backend (:4000) + frontend (:5173) พร้อมกัน
# ============================================
#
#   ./dev.sh        แล้วกด Ctrl+C ครั้งเดียวเพื่อปิดทั้งคู่
#
# Windows ใช้ dev.ps1 แทน (lsof/trap/kill ไม่มีบน Windows)
# ตรรกะเดียวกันเป๊ะ — แก้ที่ไหนแก้อีกที่ด้วย
#
# ทำไมไม่ใช้ `trap 'kill 0' SIGINT` เฉยๆ แบบเดิม:
# `dotnet run` เป็นแค่ตัวห่อ — มันไปสตาร์ต bin/Debug/net8.0/ChangeRequest.API
# อีกที พอตัวห่อตาย ตัวจริงกลายเป็น orphan (PPID 1) หลุดจาก process group
# ของ script `kill 0` เลยตามไปฆ่าไม่เจอ ผลคือมันครอง port 4000 ค้างไว้
# รอบหน้ายกใหม่ bind ไม่ได้ แล้วเว็บก็ยังคุยกับตัวเก่า (ที่อ่าน .env ชุดเก่า)
# ต่อไปเรื่อยๆ — แก้ DB_HOST ใน .env เท่าไหร่ก็ไม่มีผล
# เลยต้องเคลียร์ด้วย "ใครถือ port นี้อยู่" แทน "ใครเป็นลูกของ script"

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT=4000    # backend/.env: PORT=4000
FRONTEND_PORT=5173   # vite default — ตรงกับ CORS ใน backend/Program.cs

# ฆ่าใครก็ตามที่ LISTEN อยู่บน port นี้ (รวม orphan จากรอบก่อน)
free_port() {
  local port=$1 pids
  pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null)
  [ -z "$pids" ] && return 0

  echo "dev.sh: port $port ถูกจองอยู่ (PID $pids) — ปิดก่อน"
  kill $pids 2>/dev/null
  for _ in $(seq 1 20); do
    sleep 0.5
    pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null)
    [ -z "$pids" ] && return 0
  done

  echo "dev.sh: PID $pids ไม่ยอมตาย — kill -9"
  kill -9 $pids 2>/dev/null
  sleep 1
}

BACK_PID=""
FRONT_PID=""

cleanup() {
  trap - EXIT INT TERM          # กัน cleanup วนซ้ำตอนโดน Ctrl+C ระหว่างเก็บกวาด
  echo
  echo "dev.sh: ปิด backend + frontend"
  [ -n "$BACK_PID" ]  && kill "$BACK_PID"  2>/dev/null
  [ -n "$FRONT_PID" ] && kill "$FRONT_PID" 2>/dev/null
  free_port "$BACKEND_PORT"     # เก็บ orphan ที่ตัวห่อทิ้งไว้
  free_port "$FRONTEND_PORT"
}
trap cleanup EXIT INT TERM

# เคลียร์ของค้างจากรอบก่อนก่อนเริ่ม
free_port "$BACKEND_PORT"
free_port "$FRONTEND_PORT"

echo "dev.sh: backend  http://localhost:$BACKEND_PORT/api"
echo "dev.sh: frontend http://localhost:$FRONTEND_PORT"
echo

(cd "$ROOT/backend"  && dotnet run)   & BACK_PID=$!
(cd "$ROOT/frontend" && npm run dev)  & FRONT_PID=$!

wait
