import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: true }}
  >
    <Stack.Screen name="(tabs)" options={{ title: 'Home' }} />
    <Stack.Screen name="(tabs)/ptt" options={{ title: 'PTTs' }} />
  </Stack>;
}
