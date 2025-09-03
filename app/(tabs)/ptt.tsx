import { StyleSheet, Text, View } from "react-native";

export default function () {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PTT</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    marginTop: 50,
  },
});