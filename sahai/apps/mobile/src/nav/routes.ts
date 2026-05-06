import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ExtractResponse, ReferralResponse, Visit } from "../types";

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  PatientPicker: undefined;
  NewPatient: undefined;
  Recording: { patientId: string };
  VisitSummary: {
    patientId: string;
    visitId: string;
    rawTranscriptText: string;
    extraction: ExtractResponse;
    /**
     * When true, the screen renders an existing visit in read-only mode:
     * Save and Generate Referral buttons are hidden, autoplay is suppressed,
     * and tapping back returns to the patient profile.
     */
    readOnly?: boolean;
  };
  Referral: {
    patientId: string;
    visitId: string;
    referral: ReferralResponse;
  };
  PatientProfile: { patientId: string };
  Settings: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type { Visit };
