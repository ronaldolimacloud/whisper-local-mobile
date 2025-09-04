// lib/voiceStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VoiceMessage = {
  id: string;               // e.g., "vm_1699999999999"
  from: 'me' | 'them';      // for your UI styling; use 'me' here
  uri: string;              // FileSystem URI
  durationSec?: number;     // seconds (optional but nice)
  at: string;               // ISO timestamp
  mime?: string;            // optional, e.g., "audio/wav"
};

const KEY = 'VOICE_MESSAGES_V1';

export async function loadMessages(): Promise<VoiceMessage[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as VoiceMessage[];
    // filter out missing/invalid entries defensively
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveMessages(all: VoiceMessage[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function addMessage(msg: VoiceMessage) {
  const all = await loadMessages();
  all.push(msg);
  await saveMessages(all);
}

export async function clearMessages() {
  await AsyncStorage.removeItem(KEY);
}
