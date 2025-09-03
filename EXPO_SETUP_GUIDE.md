# Whisper.rn Setup Guide for Expo Dev Client

This guide provides step-by-step instructions for integrating `whisper.rn` into your Expo dev client build mobile app. Since `whisper.rn` is a native module that requires C++ compilation, you'll need to use Expo's development build workflow.

## Prerequisites

- Node.js 18 or higher
- Expo CLI (`npm install -g @expo/cli`)
- EAS CLI (`npm install -g eas-cli`)
- Xcode (for iOS development)
- Android Studio (for Android development)
- An Expo account

## 1. Project Setup

### 1.1 Initialize Your Expo Project (if not already done)

```bash
npx create-expo-app --template
cd your-app-name
```

### 1.2 Install Required Dependencies

```bash
# Install whisper.rn
npm install whisper.rn

# Install required peer dependencies for realtime transcription (optional)
npm install @fugood/react-native-audio-pcm-stream react-native-fs

# Install additional dependencies that might be needed
npm install react-native-gesture-handler react-native-screens
```

## 2. Configure Expo for Development Builds

### 2.1 Install Development Build Plugin

```bash
npx expo install expo-dev-client
```

### 2.2 Update app.json/app.config.js

Add the development client plugin and configure permissions:

```json
{
  "expo": {
    "name": "Your App Name",
    "slug": "your-app-slug",
    "version": "1.0.0",
    "platforms": ["ios", "android"],
    "plugins": [
      "expo-dev-client",
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "11.0"
          },
          "android": {
            "minSdkVersion": 21,
            "compileSdkVersion": 34,
            "targetSdkVersion": 34,
            "ndkVersion": "24.0.8215888"
          }
        }
      ]
    ],
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "This app requires microphone access for speech transcription"
      }
    },
    "android": {
      "package": "com.yourcompany.yourapp",
      "permissions": [
        "android.permission.RECORD_AUDIO"
      ]
    }
  }
}
```

### 2.3 Configure Metro for Asset Support

Create or update `metro.config.js`:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const defaultAssetExts = require('metro-config/src/defaults/defaults').assetExts;

const config = getDefaultConfig(__dirname);

// Add support for whisper model files
config.resolver.assetExts = [
  ...defaultAssetExts,
  'bin', // whisper.rn: ggml model binary
  'mil', // whisper.rn: CoreML model asset
];

module.exports = config;
```

## 3. Android-Specific Configuration

### 3.1 Add Proguard Rules

Create `android/app/proguard-rules.pro` (if it doesn't exist) and add:

```proguard
# whisper.rn
-keep class com.rnwhisper.** { *; }
```

### 3.2 Update Android Build Configuration

If you need to customize the Android build, create an `expo-module.config.json`:

```json
{
  "android": {
    "minSdkVersion": 21
  }
}
```

## 4. iOS-Specific Configuration

### 4.1 Extended Virtual Addressing (for larger models)

If you plan to use `medium` or `large` models, you'll need to enable Extended Virtual Addressing. This will be configured automatically when you prebuild.

### 4.2 Core ML Support (Optional)

For better performance on iOS, you can enable Core ML support. The library will automatically detect and use Core ML models if available.

## 5. Prebuild Your Project

Generate the native iOS and Android projects:

```bash
npx expo prebuild --clean
```

This will:
- Generate the `ios/` and `android/` directories
- Install CocoaPods dependencies (iOS)
- Configure native permissions and settings

## 6. Build Development Client

### 6.1 Using EAS Build (Recommended)

First, configure EAS:

```bash
eas build:configure
```

Update `eas.json`:

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "resourceClass": "medium"
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

Build for your target platform:

```bash
# For iOS
eas build --platform ios --profile development

# For Android
eas build --platform android --profile development

# For both platforms
eas build --platform all --profile development
```

### 6.2 Local Development Build (Alternative)

If you prefer to build locally:

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

## 7. Download and Prepare Whisper Models

### 7.1 Download Models

You'll need to download Whisper models from the official repository. Common models:

```bash
# Create assets directory
mkdir -p assets/models

# Download tiny.en model (39 MB) - good for testing
curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin" -o assets/models/ggml-tiny.en.bin

# Download base.en model (148 MB) - better accuracy
curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" -o assets/models/ggml-base.en.bin
```

### 7.2 Model Size Considerations

| Model | Size | Memory | Speed | Accuracy |
|-------|------|--------|-------|----------|
| tiny.en | 39 MB | ~125 MB | Fast | Basic |
| base.en | 148 MB | ~210 MB | Medium | Good |
| small.en | 488 MB | ~600 MB | Slow | Better |

Choose based on your app's requirements and target device capabilities.

## 8. Basic Implementation

### 8.1 Simple Transcription Example

```typescript
import React, { useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { initWhisper } from 'whisper.rn';

export default function WhisperExample() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');

  const transcribeAudio = async () => {
    try {
      setIsLoading(true);
      
      // Initialize Whisper context
      const whisperContext = await initWhisper({
        filePath: require('../assets/models/ggml-tiny.en.bin'),
      });

      // Transcribe audio file
      const { stop, promise } = whisperContext.transcribe(
        require('../assets/audio/sample.wav'), // Your audio file
        { 
          language: 'en',
          maxThreads: 2 
        }
      );

      const { result: transcription } = await promise;
      setResult(transcription);
      
      // Clean up
      await whisperContext.release();
      
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert('Error', 'Failed to transcribe audio');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Button
        title={isLoading ? 'Transcribing...' : 'Transcribe Audio'}
        onPress={transcribeAudio}
        disabled={isLoading}
      />
      {result ? (
        <Text style={{ marginTop: 20, fontSize: 16 }}>
          Result: {result}
        </Text>
      ) : null}
    </View>
  );
}
```

### 8.2 Realtime Transcription Example

```typescript
import React, { useState, useRef } from 'react';
import { View, Text, Button } from 'react-native';
import { initWhisper, initWhisperVad } from 'whisper.rn';
import { RealtimeTranscriber } from 'whisper.rn/realtime-transcription';
import { AudioPcmStreamAdapter } from 'whisper.rn/realtime-transcription/adapters';
import RNFS from 'react-native-fs';

export default function RealtimeExample() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const transcriberRef = useRef<RealtimeTranscriber | null>(null);

  const startRecording = async () => {
    try {
      // Initialize contexts
      const whisperContext = await initWhisper({
        filePath: require('../assets/models/ggml-tiny.en.bin'),
      });

      const vadContext = await initWhisperVad({
        filePath: require('../assets/models/ggml-silero-v5.1.2.bin'),
        useGpu: true,
        nThreads: 4,
      });

      const audioStream = new AudioPcmStreamAdapter();

      // Create transcriber
      const transcriber = new RealtimeTranscriber(
        { whisperContext, vadContext, audioStream, fs: RNFS },
        {
          audioSliceSec: 30,
          vadPreset: 'default',
          autoSliceOnSpeechEnd: true,
          transcribeOptions: { language: 'en' },
        },
        {
          onTranscribe: (event) => {
            if (event.data?.result) {
              setTranscription(prev => prev + ' ' + event.data.result);
            }
          },
          onVad: (event) => {
            console.log('VAD:', event.type, event.confidence);
          },
          onStatusChange: (isActive) => {
            console.log('Status:', isActive ? 'ACTIVE' : 'INACTIVE');
          },
          onError: (error) => {
            console.error('Transcriber error:', error);
          },
        }
      );

      transcriberRef.current = transcriber;
      await transcriber.start();
      setIsRecording(true);

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    if (transcriberRef.current) {
      await transcriberRef.current.stop();
      transcriberRef.current = null;
      setIsRecording(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Button
        title={isRecording ? 'Stop Recording' : 'Start Recording'}
        onPress={isRecording ? stopRecording : startRecording}
      />
      {transcription ? (
        <Text style={{ marginTop: 20, fontSize: 16 }}>
          Transcription: {transcription}
        </Text>
      ) : null}
    </View>
  );
}
```

## 9. Testing Your Implementation

### 9.1 Install Development Build

After EAS Build completes:
- iOS: Install the `.ipa` file via TestFlight or direct installation
- Android: Install the `.apk` file directly

### 9.2 Start Development Server

```bash
npx expo start --dev-client
```

### 9.3 Test Features

1. **Basic transcription**: Test with a sample audio file
2. **Realtime transcription**: Test microphone input
3. **Different models**: Compare accuracy and performance
4. **Error handling**: Test with invalid inputs

## 10. Optimization Tips

### 10.1 Model Selection

- Use `tiny.en` for development and testing
- Use `base.en` or `small.en` for production
- Consider quantized models for better performance

### 10.2 Performance Optimization

```typescript
// Optimize thread usage based on device
const getOptimalThreads = () => {
  // You can use react-native-device-info to detect device specs
  return 2; // Conservative default
};

const whisperContext = await initWhisper({
  filePath: require('../assets/models/ggml-tiny.en.bin'),
  maxThreads: getOptimalThreads(),
});
```

### 10.3 Memory Management

```typescript
// Always release contexts when done
useEffect(() => {
  return () => {
    if (whisperContext) {
      whisperContext.release();
    }
    if (vadContext) {
      vadContext.release();
    }
  };
}, []);
```

## 11. Troubleshooting

### 11.1 Common Issues

**Build Errors:**
- Ensure NDK version is `24.0.8215888` or higher
- Clean and rebuild: `npx expo prebuild --clean`

**iOS Build Issues:**
- Run `npx pod-install` in the iOS directory
- Check deployment target is iOS 11.0+

**Android Build Issues:**
- Verify NDK installation
- Check proguard rules are correctly applied

**Runtime Errors:**
- Verify model files are correctly bundled
- Check microphone permissions are granted
- Ensure audio files are in supported formats (WAV, MP3, etc.)

### 11.2 Performance Issues

- Use smaller models for real-time applications
- Optimize thread count based on device capabilities
- Consider using Core ML on iOS for better performance

## 12. Production Considerations

### 12.1 Model Distribution

- Consider downloading models at runtime to reduce app size
- Implement model caching and updates
- Use CDN for model distribution

### 12.2 Privacy and Permissions

- Clearly explain microphone usage to users
- Implement proper permission handling
- Consider on-device vs cloud processing trade-offs

### 12.3 Error Handling

```typescript
const handleTranscriptionError = (error: any) => {
  console.error('Transcription failed:', error);
  
  // Implement retry logic
  // Show user-friendly error messages
  // Log errors for debugging
};
```

## 13. Additional Resources

- [Whisper.rn Documentation](https://github.com/mybigday/whisper.rn)
- [Expo Development Builds](https://docs.expo.dev/development/build/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Whisper.cpp Models](https://huggingface.co/ggerganov/whisper.cpp)

## Support

If you encounter issues:

1. Check the [troubleshooting guide](https://github.com/mybigday/whisper.rn/blob/main/docs/TROUBLESHOOTING.md)
2. Review the [example app](https://github.com/mybigday/whisper.rn/tree/main/example)
3. Open an issue on the [GitHub repository](https://github.com/mybigday/whisper.rn/issues)

---

This guide should get you up and running with Whisper.rn in your Expo dev client build. Remember that this is a native module requiring compilation, so the development build workflow is essential for proper integration.
