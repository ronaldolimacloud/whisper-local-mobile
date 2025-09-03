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
import * as Haptics from 'expo-haptics';
import React, { useContext, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WhisperCtx } from '../_layout';

export default function PttScreen() {
  const whisperContext = useContext(WhisperCtx);           // <-- global context
  const modelLoaded = !!whisperContext;

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
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

  const addLog = (m: string) => setLogs((p) => [...p, `[${new Date().toLocaleTimeString()}] ${m}`]);

  // ---- iOS routing helper: leave PlayAndRecord -> play chirp (speaker) -> re-enter PlayAndRecord
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const playPTTChirpIOS = async () => {
    // 1) Leave PlayAndRecord (avoid receiver/earpiece default)
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false } as any);
    await wait(220);

    // 2) Play loud chirp
    try {
      sfxPlayer.seekTo(0);
      sfxPlayer.play();
    } catch {}

    await wait(320); // adjust to your chirp length

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
      if (!whisperContext) {
        addLog('❌ Whisper model not loaded (global)');
        Alert.alert('Error', 'Model not ready yet');
        return;
      }

      addLog('💾 Recording saved, starting transcription...');
      const { stop, promise } = whisperContext.transcribe(audioRecorder.uri, {
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

  useEffect(() => {
    requestPermissions();
    // NOTE: Do NOT release the model here — it's owned by the global provider.
  }, []);

  const handlePressIn = async () => {
    if (hapticsOn) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Play chirp loud on iOS, then return to record mode.
    if (Platform.OS === 'ios') {
      await playPTTChirpIOS();
    } else {
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
  recordingStatus: { fontSize: 14, textAlign: 'center', marginTop: 16, color: '#ff6b6b', fontWeight: 'bold' },
  resultContainer: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginVertical: 20 },
  resultTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  resultText: { fontSize: 14, color: '#333' },
  logsContainer: { marginTop: 8, backgroundColor: 'white', borderRadius: 8, padding: 12 },
  logText: { fontSize: 12, color: '#666', marginBottom: 2, fontFamily: 'monospace' },
});
