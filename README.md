# Hydra: your hybrid training coach

> 🚧 **Work in progress.** Hydra is in early development, and features, structure and APIs will change.

Hydra is an AI coaching platform for **hybrid athletes**: people who train strength, running and plyometrics together and need one coach who sees the whole picture.

Today Hydra is a chat app. You talk to the coach, and it answers using your conversation history and a set of hybrid-training rules. The goal is a full coaching platform built on the same foundation: training plans you can see and edit, specialised AI agents, and progress tracking.

## What's in it
- **Coach:** an LLM (DeepSeek) guided by a system prompt that holds the training rules
- **Frontend:** Next.js + shadcn/ui
- **Backend:** Go (Gin + GORM) with Postgres
- **Infra:** Docker, Kubernetes (minikube for now)

## License
[MIT](LICENSE)
