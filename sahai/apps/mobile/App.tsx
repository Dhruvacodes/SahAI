import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  startFeedbackWatcher,
  stopFeedbackWatcher,
} from "./src/data/feedbackStore";
import { useSettingsStore } from "./src/data/settingsStore";
import { startSyncWatcher, stopSyncWatcher } from "./src/data/syncQueue";
import { RootStack } from "./src/nav/RootStack";
import { colors } from "./src/theme";

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.cream,
    card: colors.cream,
    primary: colors.primary,
    text: colors.ink,
    border: colors.divider,
    notification: colors.accent,
  },
};

export default function App() {
  const ashaId = useSettingsStore((s) => s.ashaId);

  useEffect(() => {
    startSyncWatcher();
    return () => stopSyncWatcher();
  }, []);

  useEffect(() => {
    if (!ashaId) {
      stopFeedbackWatcher();
      return;
    }
    const stop = startFeedbackWatcher(ashaId);
    return stop;
  }, [ashaId]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer theme={navTheme}>
        <RootStack />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
