# window
npm install -g concurrently
concurrently "cd backend && dotnet run" "cd frontend && npm run dev"

# mac
trap 'kill 0' SIGINT
(cd backend && dotnet run) & (cd frontend && npm run dev) & wait

killall -9 node dotnet
