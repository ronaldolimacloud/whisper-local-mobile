import { Tabs } from "expo-router";

export default function RootLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="ptt" options={{ title: 'PTT' }} />
      <Tabs.Screen name="whisper" options={{ title: 'Whisper' }} />
    </Tabs>
  );
}