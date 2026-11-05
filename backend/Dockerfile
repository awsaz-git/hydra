# Multi-stage build: stage 1 has the full Go toolchain (~300 MB) to compile;
# stage 2 ships only the compiled binary on a tiny base image (~25 MB total).

# ---- Stage 1: build ----
FROM golang:1.26-alpine AS build
WORKDIR /src

# Copy only go.mod/go.sum first and download dependencies. Docker caches this
# layer, so later builds skip the download unless your dependencies change.
COPY go.mod go.sum ./
RUN go mod download

# Now copy the source (system_prompt.md too: it's embedded into the binary).
COPY . .

RUN CGO_ENABLED=0 go build -o /hydra-backend .

# ---- Stage 2: run ----
# distroless = no shell, no package manager, almost nothing to attack.
# ":nonroot" = the app runs as an unprivileged user, not root.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /hydra-backend /hydra-backend

ENV GIN_MODE=release
EXPOSE 8080
ENTRYPOINT ["/hydra-backend"]
