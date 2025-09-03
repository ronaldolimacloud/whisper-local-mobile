// app/_layout.tsx
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { createContext, useEffect, useState } from 'react';
import { ensureWhisper } from '../lib/whisperSingleton';

// Keep splash visible while we preload
SplashScreen.preventAutoHideAsync().catch(() => { /* noop if already prevented */ });

// Expose the whisper context app-wide (optional helper for useContext in screens)
export const WhisperCtx = createContext<any>(null);

export default function RootLayout() {
  const [ctx, setCtx] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Preload your bundled model once; adjust the path if needed
        const whisper = await ensureWhisper(
          require('../assets/models/ggml-tiny.en.bin')
        );
        if (!mounted) return;
        setCtx(whisper);
      } catch (e) {
        // If preload fails, still let the app render; log or toast if desired
        console.warn('Whisper preload failed:', e);
      } finally {
        if (mounted) {
          setReady(true);
          // Hide splash only after we decide the UI can render
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  // While loading, keep returning null so the splash stays up
  if (!ready) return null;

  return (
    <WhisperCtx.Provider value={ctx}>
      <Stack>
        {/* keep your existing tabs route and options */}
        <Stack.Screen name="(tabs)" options={{ headerShown: true }} />
      </Stack>
    </WhisperCtx.Provider>
  );
}
