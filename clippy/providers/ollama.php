<?php
/* =========================================================
 * Clippy backend adapter — Ollama provider
 * ---------------------------------------------------------
 * Passes the normalised request body through to a local
 * Ollama instance's /api/chat. Ollama's native shape is
 * already what the Clippy front-end speaks, so this is a
 * simple passthrough; it exists so other providers (which
 * DO need translation) can follow the same file shape.
 *
 * Input:  $body — Ollama /api/chat request object.
 *         $config — ['base_url' => ..., 'timeout' => ...]
 * Output: Ollama /api/chat response object.
 * ========================================================= */

declare(strict_types=1);

return function (array $body, array $config): array {
    $base    = rtrim((string)($config['base_url'] ?? 'http://127.0.0.1:11434'), '/');
    $timeout = (int)($config['timeout'] ?? 600);
    $url     = $base . '/api/chat';

    // Force non-streaming for now — the front-end's tool loop expects a
    // single full response per turn. Streaming is a future enhancement.
    $body['stream'] = false;

    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('curl_init failed');
    }
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT        => $timeout,
        // Keep things deterministic on Windows/XAMPP where CA bundles vary.
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        $no  = curl_errno($ch);
        curl_close($ch);
        throw new RuntimeException("Ollama cURL failed (errno $no): $err");
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status >= 400) {
        $snippet = substr((string)$raw, 0, 400);
        throw new RuntimeException("Ollama returned HTTP $status: $snippet");
    }

    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Ollama returned non-JSON body');
    }
    return $decoded;
};
