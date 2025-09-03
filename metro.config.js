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
