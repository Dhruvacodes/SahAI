import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useSettingsStore } from "../data/settingsStore";
import { HomeScreen } from "../screens/HomeScreen";
import { NewPatientScreen } from "../screens/NewPatientScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { PatientPickerScreen } from "../screens/PatientPickerScreen";
import { PatientProfileScreen } from "../screens/PatientProfileScreen";
import { RecordingScreen } from "../screens/RecordingScreen";
import { ReferralScreen } from "../screens/ReferralScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { VisitSummaryScreen } from "../screens/VisitSummaryScreen";
import type { RootStackParamList } from "./routes";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!hasOnboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen
            name="PatientPicker"
            component={PatientPickerScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="NewPatient"
            component={NewPatientScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen name="Recording" component={RecordingScreen} />
          <Stack.Screen name="VisitSummary" component={VisitSummaryScreen} />
          <Stack.Screen name="Referral" component={ReferralScreen} />
          <Stack.Screen name="PatientProfile" component={PatientProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
