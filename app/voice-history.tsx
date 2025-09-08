// app/voice-history.tsx
import { Ionicons } from '@expo/vector-icons';
import {
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from 'expo-audio';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    Pressable,
    SafeAreaView,
    SectionList,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { loadMessages, VoiceMessage } from '../lib/voiceStore';

/** Utils */
const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

const fmtDuration = (s?: number) => {
  if (s == null) return '';
  if (s < 1) return '< 1 sec.';
  const secs = Math.round(s);
  const mm = Math.floor(secs / 60).toString();
  const ss = (secs % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
};

function dayLabel(date: Date) {
  const today = new Date();
  const yday = new Date(); yday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(date, today)) return 'Today';
  if (same(date, yday)) return 'Yesterday';
  return date.toLocaleDateString();
}

/** Queue player */
function useQueuePlayerAudio(uris: string[]) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [index, setIndex] = useState<number | null>(null);
  const [rate, setRate] = useState(1.0);
  const advancedRef = useRef(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
  }, []);

  useEffect(() => {
    advancedRef.current = false;
    (async () => {
      if (index == null) return;
      await player.replace({ uri: uris[index] });
      player.setPlaybackRate(rate);
      player.play();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, uris.join('|')]);

  useEffect(() => {
    if (index == null || !status) return;
    const duration = status.duration ?? 0;
    const current = status.currentTime ?? 0;
    const ended = duration > 0 && current >= (duration - 0.05) && !status.playing;
    if (ended && !advancedRef.current) {
      advancedRef.current = true;
      if (index + 1 < uris.length) setIndex(index + 1);
      else setIndex(null);
    }
  }, [status, index, uris.length]);

  const play = () => { if (index == null) setIndex(0); else player.play(); };
  const pause = () => player.pause();
  const toggle = () => (status?.playing ? pause() : play());
  const prev = () => { if (index != null) setIndex(Math.max(0, index - 1)); };
  const next = () => { if (index == null) setIndex(0); else if (index + 1 < uris.length) setIndex(index + 1); };
  const jumpTo = (i: number) => setIndex(i);
  const cycleRate = () => {
    const steps = [0.8, 1.0, 1.25, 1.5, 2.0];
    const i = steps.findIndex((x) => Math.abs(x - rate) < 0.0001);
    const newRate = steps[(i + 1) % steps.length];
    setRate(newRate);
    player.setPlaybackRate(newRate);
  };

  return { index, playing: !!status?.playing, rate, play, pause, toggle, prev, next, jumpTo, cycleRate };
}

/** Screen */
export default function VoiceHistoryScreen() {
  const [msgs, setMsgs] = useState<VoiceMessage[]>([]);

  useEffect(() => {
    (async () => {
      const loaded = await loadMessages();
      // Sort oldest -> newest for iMessage-like grouping
      loaded.sort((a, b) => +new Date(a.at) - +new Date(b.at));
      setMsgs(loaded);
    })();
  }, []);

  const sections = useMemo(() => {
    const map: Record<string, VoiceMessage[]> = {};
    for (const m of msgs) {
      const k = dayLabel(new Date(m.at));
      (map[k] ??= []).push(m);
    }
    return Object.entries(map).map(([title, data]) => ({ title, data }));
  }, [msgs]);

  const uris = useMemo(() => msgs.map((m) => m.uri), [msgs]);
  const ids = useMemo(() => msgs.map((m) => m.id), [msgs]);

  const player = useQueuePlayerAudio(uris);
  const jumpById = (id: string) => {
    const idx = ids.indexOf(id);
    if (idx >= 0) player.jumpTo(idx);
  };

  return (
    <SafeAreaView style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 120 }}
        ListEmptyComponent={
          <Text style={{ color: '#8e8e93', textAlign: 'center', marginTop: 40 }}>
            No voice messages yet. Record one on the PTT screen.
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.section}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isActive={ids[player.index ?? -1] === item.id}
            onPress={() => jumpById(item.id)}
          />
        )}
      />

      {/* bottom playback bar */}
      {uris.length > 0 && (
        <View style={styles.bottomBar}>
          <IconBtn onPress={player.prev} name="play-skip-back" />
          <IconBtn onPress={player.toggle} name={player.playing ? 'pause' : 'play'} big />
          <IconBtn onPress={player.next} name="play-skip-forward" />
          <Pressable onPress={player.cycleRate} style={styles.speedBtn}>
            <Text style={styles.speedText}>
              {player.rate.toFixed(2).replace(/\.00$/, '')}x
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

/** UI pieces */
function MessageBubble({
  message, isActive, onPress,
}: {
  message: VoiceMessage;
  isActive?: boolean;
  onPress: () => void;
}) {
  const mine = message.from === 'me';
  const bubbleStyle = [
    styles.bubble,
    mine ? styles.bubbleMe : styles.bubbleThem,
    isActive && styles.activeBorder,
  ];

  return (
    <View style={[styles.row, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
      <View style={bubbleStyle}>
        <Pressable style={styles.bubbleInner} onPress={onPress} android_ripple={{ color: '#00000022' }}>
          <Ionicons
            name="play"
            size={18}
            color={mine ? '#fff' : '#d1d1d6'}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.timeText, mine ? styles.timeTextOnBlue : styles.timeTextOnGray]}>
            {fmtTime(new Date(message.at))}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.durText, mine ? styles.durTextOnBlue : styles.durTextOnGray]}>
            {fmtDuration(message.durationSec)}
          </Text>
        </Pressable>

        {/* Transcript under the audio bubble (optional) */}
        {message.transcript?.trim() ? (
          <Text
            style={[
              styles.transcript,
              mine ? styles.transcriptOnBlue : styles.transcriptOnGray,
            ]}
            numberOfLines={4}
            ellipsizeMode="tail"
          >
            {message.transcript.trim()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function IconBtn({ name, onPress, big }: { name: any; onPress: () => void; big?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.iconBtn} hitSlop={10}>
      <Ionicons name={name} size={big ? 28 : 24} color="#fff" />
    </Pressable>
  );
}

/** Styles */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  section: {
    alignSelf: 'center',
    color: '#8e8e93',
    fontSize: 13,
    marginVertical: 10,
  },

  row: { width: '100%', marginBottom: 8 },

  bubble: {
    maxWidth: '88%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  bubbleMe: {
    backgroundColor: '#0a84ff',
    marginLeft: 50,
  },
  bubbleThem: {
    backgroundColor: '#2a2a2e',
    marginRight: 50,
  },
  activeBorder: {
    borderWidth: 2,
    borderColor: '#34c759',
  },
  bubbleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 120,
  },

  timeText: { fontSize: 13 },
  durText: { fontSize: 13, fontWeight: '600' },

  timeTextOnBlue: { color: '#eaf3ff' },
  durTextOnBlue: { color: '#ffffff' },
  timeTextOnGray: { color: '#d1d1d6' },
  durTextOnGray: { color: '#f2f2f7' },

  // NEW: transcript styles
  transcript: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 4,
    fontSize: 14,
    lineHeight: 18,
  },
  transcriptOnBlue: { color: '#eaf3ff' },
  transcriptOnGray: { color: '#d1d1d6' },

  bottomBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingHorizontal: 14,
    backgroundColor: '#111',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  iconBtn: { paddingHorizontal: 10, paddingVertical: 6 },

  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
    marginLeft: 6,
  },
  speedText: { color: '#fff', fontWeight: '600' },
});
