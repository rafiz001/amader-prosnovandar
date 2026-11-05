.PHONY: build run migrate tidy
build:   ## single self-contained binary (migrations are embedded)
	go build -trimpath -ldflags="-s -w" -o bin/questionbank .
run:
	go run .
migrate:
	go run . -migrate
tidy:
	go mod tidy
