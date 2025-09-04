import { Asset } from 'expo-asset';
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingOptions,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState
} from 'expo-audio';
import React, { useEffect, useState } from 'react';
import { Alert, Button, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { initWhisper } from 'whisper.rn';

export default function Index() {
  const [isLoading, setIsLoading] = useState(false);
  const [whisperContext, setWhisperContext] = useState<any>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [result, setResult] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  
  // Audio player for testing recorded audio
  const audioPlayer = useAudioPlayer(lastRecordingUri);
  
  // Safe recording setup: Use preset for Android, WAV only on iOS
  const iosWavOptions: RecordingOptions = {
    extension: '.wav',
    sampleRate: 16000, // whisper.cpp requires 16kHz
    numberOfChannels: 1, // mono for speech
    bitRate: 16000 * 16 * 1, // 256000 bps for 16kHz, 16-bit, mono
    ios: {
      outputFormat: IOSOutputFormat.LINEARPCM,
      audioQuality: AudioQuality.MAX,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    // Provide android fields to satisfy RecordingOptions typing, not used on iOS
    android: {
      outputFormat: 'mpeg4',
      audioEncoder: 'aac',
    },
  };
  
  // Use preset on Android (stable M4A), WAV only on iOS
  const audioRecorder = useAudioRecorder(
    Platform.OS === 'ios' ? iosWavOptions : RecordingPresets.HIGH_QUALITY
  );
  const recorderState = useAudioRecorderState(audioRecorder);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  };

  // Request microphone permissions
  const requestPermissions = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (status.granted) {
        setPermissionGranted(true);
        addLog('✅ Microphone permission granted');
        
        // Only use keys documented in expo-audio (not expo-av legacy keys)
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
        addLog('📱 Audio mode configured for recording');
      } else {
        setPermissionGranted(false);
        addLog('❌ Microphone permission denied');
        Alert.alert('Permission Required', 'Microphone access is required for voice transcription');
      }
    } catch (error: unknown) {
      addLog(`❌ Permission error: ${getErrorMessage(error)}`);
    }
  };

  // Start recording
  const startRecording = async () => {
    if (!permissionGranted) {
      await requestPermissions();
      return;
    }

    try {
      setIsLoading(true);
      addLog('🎤 Starting recording...');
      
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      
      addLog('🔴 Recording started - speak now!');
    } catch (error) {
      addLog(`❌ Recording start error: ${error}`);
      Alert.alert('Error', 'Failed to start recording');
    } finally {
      setIsLoading(false);
    }
  };

  // Stop recording and transcribe
  const stopRecordingAndTranscribe = async () => {
    if (!recorderState.isRecording) {
      Alert.alert('Error', 'No recording in progress');
      return;
    }

    try {
      setIsLoading(true);
      addLog('⏹️ Stopping recording...');
      
      // Stop recording - the URI will be available on audioRecorder.uri
      await audioRecorder.stop();
      
      if (!audioRecorder.uri) {
        addLog('❌ No recording URI available');
        Alert.alert('Error', 'Recording failed - no audio data');
        return;
      }

      addLog(`💾 Recording saved to: ${audioRecorder.uri}`);
      addLog(`📊 Recording duration: ${(recorderState.durationMillis / 1000).toFixed(2)}s`);
      
      // Save the recording URI for playback testing
      setLastRecordingUri(audioRecorder.uri);
      
      // Check if recording is too short
      if (recorderState.durationMillis < 500) {
        addLog('⚠️ Recording is very short (< 0.5s) - may not contain speech');
      }
      
      // Check the actual file path and format
      const fileName = audioRecorder.uri.split('/').pop();
      const fileExtension = audioRecorder.uri.split('.').pop();
      addLog(`📁 File name: ${fileName}`);
      addLog(`🔧 File extension: ${fileExtension}`);
      addLog(`📏 Expected format: WAV for whisper.rn compatibility`);
      
      addLog('💾 Recording saved, starting transcription...');
      
      if (!whisperContext) {
        addLog('❌ Whisper model not loaded');
        Alert.alert('Error', 'Please load the Whisper model first');
        return;
      }

      // Transcribe the recorded audio using the official example pattern
      addLog(`🔍 Audio file format: ${audioRecorder.uri.split('.').pop()}`);
      addLog(`🔍 Audio duration: ${(recorderState.durationMillis / 1000).toFixed(2)}s`);
      addLog(`🔍 Starting transcription with simplified settings...`);
      
      const { stop, promise } = whisperContext.transcribe(audioRecorder.uri, {
        maxLen: 1,
        tokenTimestamps: true,
        language: 'en',
        onProgress: (progress: number) => {
          addLog(`📈 Transcription progress: ${progress}%`);
        },
      });

      addLog('⏳ Transcribing your speech...');
      
      // Add timeout for transcription
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          addLog('⏰ Transcription timeout - stopping...');
          stop();
          reject(new Error('Transcription timeout after 30 seconds'));
        }, 30000);
      });

      const transcriptionResult = await Promise.race([promise, timeoutPromise]);
      const { result: transcription, segments } = transcriptionResult as any;

      addLog('✅ Transcription completed!');
      addLog(`📝 Raw result: "${transcription}"`);
      addLog(`📊 Number of segments: ${segments?.length || 0}`);
      
      if (segments && segments.length > 0) {
        segments.forEach((segment: any, index: number) => {
          addLog(`🎯 Segment ${index + 1}: "${segment.text}" [${segment.t0} - ${segment.t1}]`);
        });
      }
      
      if (!transcription || transcription.trim() === '') {
        addLog('⚠️ Empty transcription result');
        addLog('🔍 Possible causes:');
        addLog('   1. Audio format incompatibility (needs WAV format)');
        addLog('   2. Audio too quiet or silent');
        addLog('   3. Audio too short or background noise only');
        addLog(`   4. File extension is: ${fileExtension}`);
        
        if (fileExtension?.toLowerCase() !== 'wav') {
          addLog('❌ PROBLEM FOUND: File is not in WAV format!');
          addLog('💡 whisper.rn requires WAV files for transcription');
          setResult(`Audio format issue: File is ${fileExtension?.toUpperCase()} but whisper.rn needs WAV format. Try updating recording settings.`);
        } else {
          setResult('No speech detected. Try speaking louder or closer to the microphone.');
        }
      } else {
        addLog(`✅ Successfully transcribed: "${transcription}"`);
        setResult(`You said: "${transcription.trim()}"`);
      }

    } catch (error: unknown) {
      console.error('Recording/Transcription error:', error);
      addLog(`❌ Error: ${getErrorMessage(error)}`);
      
      if (error instanceof Error && error.message?.includes('timeout')) {
        setResult('Transcription timed out. Please try again with clearer speech.');
      } else {
        setResult('Recording or transcription failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadModel = async () => {
    try {
      setIsLoading(true);
      addLog('Loading whisper model via expo-asset...');
      
      // Load model safely using expo-asset to avoid Metro crashes
      const modelAsset = Asset.fromModule(require('../../assets/models/ggml-tiny.en.bin'));
      await modelAsset.downloadAsync();
      const modelPath = modelAsset.localUri!;
      
      addLog(`📁 Model path: ${modelPath}`);
      
      // Initialize Whisper context with the resolved file path
      const context = await initWhisper({
        filePath: modelPath,
      });

      setWhisperContext(context);
      setModelLoaded(true);
      addLog('✅ Model loaded successfully!');
      
    } catch (error) {
      console.error('Model loading error:', error);
      addLog(`❌ Error loading model: ${error}`);
      Alert.alert('Error', 'Failed to load whisper model');
    } finally {
      setIsLoading(false);
    }
  };

  const testTranscription = async () => {
    if (!whisperContext) {
      Alert.alert('Error', 'Please load the model first');
      return;
    }

    try {
      setIsLoading(true);
      addLog('Testing transcription...');
      
      // Try to transcribe the sample audio file
      try {
        addLog('🎵 Loading sample.wav for transcription...');
        addLog('⚠️ Note: Very short audio files (< 1 second) may cause issues');
        
        const audioPath = require('../../assets/audio/sample.wav');
        addLog('📁 Audio file loaded, starting transcription...');
        
        // Use the correct API format according to whisper.rn documentation
        const { stop, promise } = whisperContext.transcribe(audioPath, {
          language: 'en',
          maxThreads: 2,
          wordTimestamps: false,
          speedUp: false
        });
        
        addLog('⏳ Transcribing audio... (waiting max 30 seconds)');
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            addLog('⏰ Transcription timeout - stopping...');
            stop(); // Stop the transcription
            reject(new Error('Transcription timeout after 30 seconds'));
          }, 30000);
        });
        
        const transcriptionResult = await Promise.race([promise, timeoutPromise]);
        const { result: transcription } = transcriptionResult as any;
        
        addLog('✅ Transcription completed!');
        addLog(`📝 Result: "${transcription}"`);
        
        if (!transcription || transcription.trim() === '') {
          addLog('⚠️ Empty transcription - audio may be too short or silent');
          setResult('Transcription completed but no text detected. Audio may be too short (0.07s) or silent.');
        } else {
          setResult(`Transcription: "${transcription}"`);
        }
        
      } catch (audioError: unknown) {
        console.error('Audio transcription error:', audioError);
        addLog(`❌ Audio transcription failed: ${getErrorMessage(audioError)}`);
        
        if (audioError instanceof Error && audioError.message?.includes('timeout')) {
          addLog('💡 Try using a longer audio file (at least 1-2 seconds)');
          setResult('Transcription timed out. Your 0.07s audio file may be too short for processing.');
        } else {
          addLog('✅ Whisper context is ready for transcription!');
          addLog('ℹ️ Audio file found but transcription failed - check audio format');
          setResult('Whisper is ready! Audio file found but transcription failed.');
        }
      }
      
    } catch (error: unknown) {
      console.error('Transcription error:', error);
      addLog(`❌ Transcription error: ${getErrorMessage(error)}`);
      Alert.alert('Error', 'Failed to test transcription');
    } finally {
      setIsLoading(false);
    }
  };

  const releaseModel = async () => {
    if (whisperContext) {
      try {
        await whisperContext.release();
        setWhisperContext(null);
        setModelLoaded(false);
        addLog('✅ Model released');
      } catch (error: unknown) {
        addLog(`❌ Error releasing model: ${getErrorMessage(error)}`);
      }
    }
  };

  useEffect(() => {
    // Request permissions on app start
    requestPermissions();
    
    return () => {
      // Cleanup on unmount
      if (whisperContext) {
        whisperContext.release();
      }
    };
  }, [whisperContext]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Whisper.rn Test</Text>
      
      <View style={styles.buttonContainer}>
        <Button
          title={isLoading ? 'Loading...' : modelLoaded ? 'Model Loaded ✅' : 'Load Model'}
          onPress={loadModel}
          disabled={isLoading || modelLoaded}
        />
        
        <Button
          title={isLoading ? 'Testing...' : 'Test with Sample File'}
          onPress={testTranscription}
          disabled={isLoading || !modelLoaded}
        />
        
        {/* New Recording Controls */}
        <View style={styles.recordingSection}>
          <Text style={styles.sectionTitle}>🎤 Voice Recording</Text>
          
          <Button
            title={
              !permissionGranted ? 'Grant Microphone Permission' :
              recorderState.isRecording ? '⏹️ Stop & Transcribe' :
              isLoading ? 'Processing...' : '🔴 Start Recording'
            }
            onPress={recorderState.isRecording ? stopRecordingAndTranscribe : startRecording}
            disabled={isLoading || !modelLoaded}
            color={recorderState.isRecording ? "#ff6b6b" : "#4CAF50"}
          />
          
          {recorderState.isRecording && (
            <Text style={styles.recordingStatus}>
              🔴 Recording... Speak into your microphone
            </Text>
          )}
          
          {lastRecordingUri && !recorderState.isRecording && (
            <Button
              title="🔊 Play Last Recording"
              onPress={() => {
                addLog('▶️ Playing back recorded audio...');
                // Safe playback - check if source is loaded first
                if (audioPlayer && lastRecordingUri) {
                  audioPlayer.seekTo(0);
                  audioPlayer.play();
                } else {
                  addLog('❌ Audio player not ready');
                }
              }}
              disabled={isLoading}
              color="#2196F3"
            />
          )}
        </View>
        
        <Button
          title="Release Model"
          onPress={releaseModel}
          disabled={!modelLoaded}
          color="#ff6b6b"
        />
      </View>

      {result ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Result:</Text>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}

      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>Logs:</Text>
        <ScrollView style={styles.logsScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    marginTop: 50,
  },
  buttonContainer: {
    gap: 15,
    marginBottom: 20,
  },
  recordingSection: {
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  recordingStatus: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    color: '#ff6b6b',
    fontWeight: 'bold',
  },
  resultContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
  },
  logsContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logsScroll: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});
