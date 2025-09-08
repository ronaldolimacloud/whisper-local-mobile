// app/ptt-screen.tsx
// Requires: expo-audio, expo-haptics
// Uses the WhisperCtx provided in app/_layout.tsx

import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { addMessage, updateMessageTranscript } from '../../lib/voiceStore';
import { theme } from '../../theme';
import { WhisperCtx } from '../_layout';



export default function PttScreen() {
  const whisperContext = useContext(WhisperCtx); // <-- global context
  const modelLoaded = !!whisperContext;

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  const [lastRecordingDurationMs, setLastRecordingDurationMs] = useState<number | null>(null);

  // Visual state for the button image
  const [isHolding, setIsHolding] = useState(false);
  // Ref to guard async chains if user releases early
  const isHeldRef = useRef(false);

  const hapticsOn = true;

  // 16 kHz mono WAV on iOS for whisper.cpp
  const iosWavOptions = {
    extension: '.wav',
    sampleRate: 16000,
    numberOfChannels: 1,
    ios: {
      outputFormat: IOSOutputFormat.LINEARPCM,
      audioQuality: AudioQuality.MAX,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
  };

  const audioRecorder = useAudioRecorder(
    Platform.OS === 'ios' ? (iosWavOptions as any) : RecordingPresets.HIGH_QUALITY
  );
  const recorderState = useAudioRecorderState(audioRecorder);

  // PTT chirp SFX
  const sfxPlayer = useAudioPlayer(require('../../assets/audio/talk.wav'));
  // Player to playback the last recording (safer pattern for dynamic URIs)
  const recordingPlaybackPlayer = useAudioPlayer(null);

  const addLog = (m: string) => setLogs((p) => [...p, `[${new Date().toLocaleTimeString()}] ${m}`]);

  // ---- small util
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // whenever lastRecordingUri changes, (re)load the player source
  useEffect(() => {
    (async () => {
      if (lastRecordingUri) {
        try {
          await recordingPlaybackPlayer.replace({ uri: lastRecordingUri } as any);
        } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRecordingUri]);

  // ensure an app folder exists to keep your wavs
  async function ensureRecordingsDir() {
    const dir = (FileSystem.documentDirectory || '') + 'recordings/';
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    return dir;
  }

  // copy/move the temp file into your app folder with a timestamped name
  async function persistRecordingFile(tempUri: string, ext = '.wav') {
    const dir = await ensureRecordingsDir();
    const ts = new Date();
    const filename = `ptt_${ts.toISOString().replace(/[:.]/g, '-')}${ext}`;
    const dest = dir + filename;
    // On iOS/Android, temp URIs can disappear — copy is safer than move
    await FileSystem.copyAsync({ from: tempUri, to: dest });
    return dest;
  }

  // ---- iOS routing helper:
  // Leave PlayAndRecord -> play chirp (speaker) -> re-enter PlayAndRecord.
  // We flip to GREEN exactly at the moment we call play().
  const playPTTChirpIOS = async () => {
    // 1) Leave PlayAndRecord (avoid receiver/earpiece default)
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false } as any);
    await wait(220); // let routing settle

    // 2) Start chirp and flip image exactly when sound starts
    if (!isHeldRef.current) return; // user may have let go already
    setIsHolding(true); // <-- switch to GREEN right as we play
    try {
      sfxPlayer.seekTo(0);
      sfxPlayer.play();
    } catch {}

    await wait(320); // adjust to match chirp length

    // 3) Re-enter PlayAndRecord for mic capture
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true } as any);
    await wait(120);
  };

  const requestPermissions = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setPermissionGranted(false);
        addLog('❌ Microphone permission denied');
        Alert.alert('Permission Required', 'Microphone access is required for voice transcription');
        return;
      }
      setPermissionGranted(true);
      addLog('✅ Microphone permission granted');

      // Base audio mode (Android flag keeps output off the earpiece)
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,            // iOS: PlayAndRecord (defaults to earpiece)
        shouldRouteThroughEarpiece: false // Android-only
      } as any);
    } catch (e) {
      addLog(`❌ Permission error: ${e}`);
    }
  };

  const startRecording = async () => {
    try {
      setIsLoading(true);
      addLog('🎤 Starting recording...');
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      addLog('🔴 Recording started - speak now!');
    } catch (e) {
      addLog(`❌ Recording start error: ${e}`);
      Alert.alert('Error', 'Failed to start recording');
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecordingAndTranscribe = async () => {
    if (!recorderState.isRecording) return;
    try {
      setIsLoading(true);
      addLog('⏹️ Stopping recording...');
      await audioRecorder.stop();

      if (!audioRecorder.uri) {
        addLog('❌ No recording URI available');
        Alert.alert('Error', 'Recording failed - no audio data');
        return;
      }

      // Persist the temp file into your app folder
      const persistedUri = await persistRecordingFile(
        audioRecorder.uri,
        Platform.OS === 'ios' ? '.wav' : '.m4a'
      );

      // Track local playback state
      const durMs = recorderState.durationMillis || null;
      setLastRecordingUri(persistedUri);
      setLastRecordingDurationMs(durMs);
      addLog(`💾 Saved recording for playback: ${persistedUri}`);

      // Create the message in history now (without transcript yet)
      const id = `vm_${Date.now()}`;
      const atISO = new Date().toISOString();
      await addMessage({
        id,
        from: 'me',
        uri: persistedUri,
        durationSec: durMs ? Math.round(durMs / 1000) : undefined,
        at: atISO,
        mime: Platform.OS === 'ios' ? 'audio/wav' : 'audio/m4a',
      });

      // Whisper must exist
      if (!whisperContext) {
        addLog('❌ Whisper model not loaded (global)');
        Alert.alert('Error', 'Model not ready yet');
        return;
      }

      addLog('💾 Recording saved, starting transcription...');

      // IMPORTANT: transcribe the *persisted* file, not the temp URI
      const { stop, promise } = whisperContext.transcribe(persistedUri, {
        language: 'en',
        maxLen: 1,
        tokenTimestamps: true,
      });

      const timeout = new Promise((_, rej) => {
        setTimeout(() => {
          addLog('⏰ Transcription timeout - stopping...');
          stop();
          rej(new Error('Transcription timeout after 30 seconds'));
        }, 30000);
      });

      const { result: text } = (await Promise.race([promise, timeout])) as any;

      if (!text || !text.trim()) {
        addLog('⚠️ Empty transcription result');
        setResult('No speech detected. Try speaking louder or closer to the microphone.');
        if (hapticsOn) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        const trimmed = text.trim();
        addLog(`✅ Transcribed: "${trimmed}"`);
        setResult(trimmed);

        // NEW: persist transcript on the just-created message
        await updateMessageTranscript(id, trimmed);

        if (hapticsOn) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      addLog(`❌ Error: ${e?.message || e}`);
      if (e?.message?.includes('timeout')) setResult('Transcription timed out. Please try again.');
      if (hapticsOn) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    requestPermissions();
    // NOTE: Do NOT release the model here — it's owned by the global provider.
  }, []);

  const handlePressIn = () => {
    isHeldRef.current = true; // start "held" window
    if (hapticsOn) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (Platform.OS === 'ios') {
      // Don't await — let UI breathe; playPTTChirpIOS will flip to GREEN at play()
      void playPTTChirpIOS().then(async () => {
        if (!isHeldRef.current) return; // user already released
        if (!permissionGranted) await requestPermissions();
        if (!modelLoaded || isLoading || recorderState.isRecording) return;
        await startRecording();
      });
    } else {
      // Android: flip to GREEN exactly as we play the chirp
      setIsHolding(true);
      try {
        sfxPlayer.seekTo(0);
        sfxPlayer.play();
      } catch {}

      // Defer heavy work to next tick to avoid blocking render
      setTimeout(async () => {
        if (!isHeldRef.current) return;
        if (!permissionGranted) await requestPermissions();
        if (!modelLoaded || isLoading || recorderState.isRecording) return;
        await startRecording();
      }, 0);
    }
  };

  const handlePressOut = async () => {
    isHeldRef.current = false;
    setIsHolding(false);
    if (hapticsOn) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Stop chirp if still playing (AudioPlayer has no .stop(); use pause + seekTo)
    try {
      sfxPlayer.pause();
      sfxPlayer.seekTo(0);
    } catch {}

    if (recorderState.isRecording) await stopRecordingAndTranscribe();
  };

  const playLastRecording = async () => {
    if (!lastRecordingUri) {
      addLog('❌ No recording to play');
      return;
    }
    try {
      addLog('▶️ Playing back last recording...');
      if (Platform.OS === 'ios') {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false } as any);
        await wait(120);
      }
      try {
        recordingPlaybackPlayer.seekTo(0);
        recordingPlaybackPlayer.play();
      } catch {}
      if (Platform.OS === 'ios' && lastRecordingDurationMs && lastRecordingDurationMs > 0) {
        setTimeout(async () => {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true } as any);
        }, Math.min(lastRecordingDurationMs + 250, 10000));
      }
    } catch (e) {
      addLog(`❌ Playback error: ${e}`);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
    <View style={styles.container}>
      <Link href="/voice-history">
        <ThemedText variant="h1" align="center" style={styles.title}>click to see history</ThemedText>
      </Link>

      <View style={styles.controls}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.pttButton,
            { opacity: !modelLoaded ? 0.6 : pressed ? 0.9 : 1 },
          ]}
          android_ripple={{ color: '#ffffff22' }}
          disabled={!modelLoaded}
        >
          <Image
            source={
              isHolding
                ? require('../../assets/images/presstotalk_green.png')
                : require('../../assets/images/presstotalk.png')
            }
            style={styles.pttImage}
          />
        </Pressable>
        {lastRecordingUri && !recorderState.isRecording ? (
          <Pressable
            onPress={playLastRecording}
            style={({ pressed }) => [
              styles.playbackButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            android_ripple={{ color: '#00000011' }}
          >
            <ThemedText variant="body" weight="700" style={styles.playbackText}>▶ Play Last Recording</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {recorderState.isRecording ? (
        <ThemedText variant="caption" weight="700" align="center" style={styles.recordingStatus}>
          🔴 Recording… Speak now
        </ThemedText>
      ) : null}

      {result ? (
        <View style={styles.resultContainer}>
          <ThemedText variant="title" weight="700" style={styles.resultTitle}>Result</ThemedText>
          <ThemedText variant="body" color="text" style={styles.resultText}>{result}</ThemedText>
        </View>
      ) : null}

      <View style={styles.logsContainer}>
        {logs.slice(-6).map((log, idx) => (
          <ThemedText key={`${idx}-${log}`} variant="caption" color="mutedText" style={styles.logText}>
            {log}
          </ThemedText>
        ))}
      </View>
    </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { marginBottom: 30, marginTop: 50 },
  scrollContent: { flexGrow: 1 },
  controls: { gap: 16, alignItems: 'center' },
  pttButton: { padding: 18, borderRadius: 12, alignItems: 'center', minWidth: 200 },
  pttImage: { width: 400, height: 400, resizeMode: 'contain' },
  pttText: { fontWeight: 'bold' },
  recordingStatus: { marginTop: 16, color: theme.colors.warning },
  resultContainer: { backgroundColor: theme.colors.background, padding: 15, borderRadius: 8, marginVertical: 20 },
  resultTitle: { marginBottom: 6 },
  resultText: {},
  logsContainer: { marginTop: 8, backgroundColor: theme.colors.background, borderRadius: 8, padding: 12 },
  playbackButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: theme.colors.background },
  playbackText: {},
  logText: { fontFamily: 'monospace' },
});
