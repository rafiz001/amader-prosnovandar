package main

import (
	_ "embed"
	"net/http"
)

// The API description is compiled into the binary (edit openapi.json, then rebuild).
//
//go:embed openapi.json
var openapiJSON []byte

func serveOpenAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(openapiJSON)
}
