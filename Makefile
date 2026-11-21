# rustup installs cargo in ~/.cargo/bin, which is not on PATH in every shell
# (IDE tasks, non-interactive terminals). Make sure every target can find it.
export PATH := $(HOME)/.cargo/bin:$(PATH)

.PHONY: install wasm web preview dev desktop test check desktop-check fmt clean

install: ## install the wasm target, the Tauri CLI and the frontend dependencies
	rustup target add wasm32-unknown-unknown
	npm install
	cd frontend && npm install

wasm: ## build the browser WebAssembly module (release)
	cd frontend && npm run wasm:release

web: ## build the browser app into frontend/dist
	cd frontend && npm run build

preview: ## serve the built browser app on http://localhost:4173
	cd frontend && npm run preview

dev: ## run the desktop app with hot reload
	npm run dev

desktop: ## build the desktop bundle
	npm run build

test: ## run the shared Rust core tests
	cargo test -p questionbank-core

check: ## type-check the Rust workspaces
	cargo check -p questionbank-core
	cargo check -p questionbank-wasm --target wasm32-unknown-unknown

desktop-check: ## type-check the Tauri shell (needs the system libraries)
	cargo check -p questionbank-desktop

fmt:
	cargo fmt --all

clean:
	cargo clean
	rm -rf frontend/src/wasm
