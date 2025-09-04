import { View } from "react-native";
import { ThemedText } from "../../components/ThemedText";

export default function Colour() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      <ThemedText variant="display">Brand Display</ThemedText>
      <ThemedText variant="h1">Heading 1</ThemedText>
      <ThemedText variant="title">Title</ThemedText>
      <ThemedText variant="subtitle" color="mutedText">Subtitle muted</ThemedText>
      <ThemedText>Body default</ThemedText>
      <ThemedText variant="callout" color="success">Success text</ThemedText>
      <ThemedText variant="caption" uppercase color="warning">caption warning</ThemedText>
      <ThemedText variant="overline" align="center" color="error">overline error</ThemedText>
    </View>
  );
}