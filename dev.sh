killall -9 node

# mac
trap 'kill 0' SIGINT
(cd backend && npm run dev) & (cd frontend && npm run dev) & wait

