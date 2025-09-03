// lib/whisperSingleton.ts
// Preloads a Whisper model (bundled asset) once and shares the same context app-wide.
// Usage (anywhere):  await ensureWhisper(require('../assets/models/ggml-tiny.en.bin'));

import { Asset } from 'expo-asset';
import { initWhisper } from 'whisper.rn';

// Keep a single context per JS runtime
let ctx: any | null = null;
// Coalesce concurrent callers so we only init once
let loading: Promise<any> | null = null;

/**
 * Ensure the Whisper context is initialized.
 * Pass the model via require('path/to/model.bin') on first call.
 */
export async function ensureWhisper(modelRequire?: number): Promise<any> {
  if (ctx) return ctx;
  if (loading) return loading;

  if (!modelRequire) {
    throw new Error(
      'ensureWhisper: first call must include the model require(), e.g. ensureWhisper(require("../assets/models/ggml-tiny.en.bin"))'
    );
  }

  loading = (async () => {
    // 1) Resolve and (if needed) download the asset to a local file
    const asset = Asset.fromModule(modelRequire);
    await asset.downloadAsync(); // cached across runs once downloaded

    const filePath = asset.localUri ?? asset.uri;
    if (!filePath) {
      throw new Error('ensureWhisper: model asset has no localUri/uri after download');
    }

    // 2) Initialize whisper context with the local file path
    ctx = await initWhisper({ filePath });

    // Clear the loading latch after success
    loading = null;
    return ctx;
  })().catch((err) => {
    // If init fails, allow retry later
    loading = null;
    throw err;
  });

  return loading;
}

/** Get the existing Whisper context (or null if not initialized). */
export function getWhisper(): any | null {
  return ctx;
}

/** Release the Whisper context to free memory (optional). */
export async function releaseWhisper(): Promise<void> {
  try {
    await ctx?.release?.();
  } finally {
    ctx = null;
    loading = null;
  }
}
