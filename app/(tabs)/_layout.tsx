import { DarkTheme, ThemeProvider } from "@react-navigation/native";

import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function RootLayout() {
  const theme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#1e1e1e',
      color: '#fa260b',
    },
    fonts: {
      ...DarkTheme.fonts,
      fontFamily: 'Roboto',
      color: '#fa260b',
    },
    dark: true,
  };
  return (
    <ThemeProvider value={theme}>
    <Tabs screenOptions={{ tabBarActiveTintColor: '#a65247', }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="ptt" options={{ title: 'PTT' }} />
      <Tabs.Screen name="whisper" options={{ title: 'Whisper', headerShown: false, tabBarIcon: ({ color, size }) => (
        <Ionicons name="mic" size={size} color={color} />
      ) }} />
      <Tabs.Screen name="colour" options={{ title: 'Colour' }} />
    </Tabs>
    </ThemeProvider>
  );
}