#!/usr/bin/env bash
# รัน backend + frontend พร้อมกัน — Ctrl-C ทีเดียวปิดทั้งคู่
set -u

# เคลียร์ process ที่ค้างอยู่บน port ของโปรเจกต์นี้เท่านั้น
# (เดิมใช้ killall -9 node ซึ่งฆ่า node ทุกตัวในเครื่อง — รวม editor server,
#  build watcher, โปรเจกต์อื่นที่เปิดค้างไว้)
for port in 4000 5173; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "ปิด process ที่ค้างบน port $port: $pids"
    kill -9 $pids 2>/dev/null || true
  fi
done

trap 'kill 0' SIGINT
(cd backend && npm run dev) & (cd frontend && npm run dev) & wait
