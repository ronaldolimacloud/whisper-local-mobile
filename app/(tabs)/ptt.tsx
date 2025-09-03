// app/ptt-screen.tsx (or any screen)
// Requires: expo-audio, expo-asset, expo-haptics, whisper.rn
// Assets used here:
//   - ../../assets/models/ggml-tiny.en.bin
//   - ../../assets/audio/talk.wav  (the PTT chirp)

import { Asset } from 'expo-asset';
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
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { initWhisper } from 'whisper.rn';

export default function PttScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [whisperContext, setWhisperContext] = useState<any>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [result, setResult] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const hapticsOn = true; // make this a user setting if you like

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

  const addLog = (m: string) => setLogs(p => [...p, `[${new Date().toLocaleTimeString()}] ${m}`]);

  // ---- iOS routing helper: leave PlayAndRecord -> play chirp (speaker) -> re-enter PlayAndRecord
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

  const playPTTChirpIOS = async () => {
    // 1) Leave PlayAndRecord (so iOS stops preferring the receiver/earpiece)
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false } as any);
    await wait(220); // let route flip to speaker

    // 2) Play chirp loudly
    try {
      sfxPlayer.seekTo(0);
      sfxPlayer.play();
    } catch {}

    // adjust to your chirp length (300–350ms typical)
    await wait(320);

    // 3) Re-enter PlayAndRecord for mic capture
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true } as any);
    await wait(120); // give AVAudioSession time to settle
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

      // Base audio mode for the app
      await setAudioModeAsync({
        playsInSilentMode: true,           // iOS: allow playback in silent mode
        allowsRecording: true,             // iOS: enters PlayAndRecord category (earpiece by default)
        shouldRouteThroughEarpiece: false, // ANDROID ONLY: keep off the earpiece
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
      if (!whisperContext) {
        addLog('❌ Whisper model not loaded');
        Alert.alert('Error', 'Please load the Whisper model first');
        return;
      }

      addLog('💾 Recording saved, starting transcription...');
      const { stop, promise } = whisperContext.transcribe(audioRecorder.uri, {
        language: 'en',
        maxLen: 1,
        tokenTimestamps: true,
      });

      // Timeout guard (30s)
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
        addLog(`✅ Transcribed: "${text}"`);
        setResult(text.trim());
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

  const loadModel = async () => {
    try {
      setIsLoading(true);
      addLog('📦 Loading whisper model via expo-asset...');
      const modelAsset = Asset.fromModule(require('../../assets/models/ggml-tiny.en.bin'));
      await modelAsset.downloadAsync();
      const ctx = await initWhisper({ filePath: modelAsset.localUri! });
      setWhisperContext(ctx);
      setModelLoaded(true);
      addLog('✅ Model loaded successfully!');
      if (hapticsOn) void Haptics.selectionAsync();
    } catch (e) {
      addLog(`❌ Error loading model: ${e}`);
      Alert.alert('Error', 'Failed to load whisper model');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    requestPermissions();
    return () => {
      whisperContext?.release?.();
    };
  }, [whisperContext]);

  const handlePressIn = async () => {
    if (hapticsOn) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Play chirp LOUD on iOS, then return to record mode.
    if (Platform.OS === 'ios') {
      await playPTTChirpIOS();
    } else {
      // Android: keep routing off the earpiece & play immediately
      sfxPlayer.seekTo(0);
      sfxPlayer.play();
    }

    if (!permissionGranted) await requestPermissions();
    if (!modelLoaded || isLoading || recorderState.isRecording) return;
    await startRecording();
  };

  const handlePressOut = async () => {
    if (hapticsOn) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (recorderState.isRecording) await stopRecordingAndTranscribe();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PTT</Text>

      <View style={styles.controls}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.pttButton,
            { backgroundColor: pressed ? '#ff6b6b' : '#4CAF50' },
            { opacity: !modelLoaded ? 0.6 : 1 },
          ]}
          android_ripple={{ color: '#ffffff22' }}
          disabled={!modelLoaded}
        >
          <Text style={styles.pttText}>
            {recorderState.isRecording ? 'Release to stop' : 'Hold to talk'}
          </Text>
        </Pressable>

        <Pressable
          onPress={loadModel}
          style={[styles.secondaryButton, { opacity: isLoading || modelLoaded ? 0.6 : 1 }]}
          disabled={isLoading || modelLoaded}
        >
          <Text style={styles.secondaryText}>
            {isLoading ? 'Loading…' : modelLoaded ? 'Model Loaded ✅' : 'Load Model'}
          </Text>
        </Pressable>
      </View>

      {recorderState.isRecording ? (
        <Text style={styles.recordingStatus}>🔴 Recording… Speak now</Text>
      ) : null}

      {result ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Result</Text>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}

      <View style={styles.logsContainer}>
        {logs.slice(-6).map((log, idx) => (
          <Text key={`${idx}-${log}`} style={styles.logText}>
            {log}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, marginTop: 50 },
  controls: { gap: 16, alignItems: 'center' },
  pttButton: { padding: 18, borderRadius: 12, alignItems: 'center', minWidth: 200 },
  pttText: { color: 'white', fontWeight: 'bold' },
  secondaryButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#222' },
  secondaryText: { color: 'white', fontWeight: '600' },
  recordingStatus: { fontSize: 14, textAlign: 'center', marginTop: 16, color: '#ff6b6b', fontWeight: 'bold' },
  resultContainer: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginVertical: 20 },
  resultTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  resultText: { fontSize: 14, color: '#333' },
  logsContainer: { marginTop: 8, backgroundColor: 'white', borderRadius: 8, padding: 12 },
  logText: { fontSize: 12, color: '#666', marginBottom: 2, fontFamily: 'monospace' },
});
