import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

/**
 * Renders the initial Sahai mobile shell.
 *
 * @returns The Expo root component.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sahai Mobile</Text>
      <Text style={styles.subtitle}>Expo React Native app shell</Text>
      <StatusBar style="auto" />
    </View>
  );
}

/**
 * Base styles for the first mobile screen.
 */
const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  subtitle: {
    color: "#4b5563",
    fontSize: 16,
    marginTop: 8
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700"
  }
});

