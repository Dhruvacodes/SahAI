import { Audio } from "expo-av";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { ASHAWorker, Patient } from "../../packages/shared-types";

const LANGUAGES = [
  { label: "Hindi", code: "hi" },
  { label: "Tamil", code: "ta" },
  { label: "Bengali", code: "bn" },
  { label: "Kannada", code: "kn" },
  { label: "Telugu", code: "te" },
  { label: "Marathi", code: "mr" },
  { label: "Gujarati", code: "gu" },
  { label: "Odia", code: "or" }
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];

type RecordingStatus = "idle" | "listening" | "processing";

/**
 * Props used to record visit audio and return a transcript to the caller.
 */
export interface VoiceInputScreenProps {
  /** Identifier for the patient associated with the voice note. */
  patientId: Patient["id"];
  /** Identifier for the ASHA worker recording the voice note. */
  ashaId: ASHAWorker["id"];
  /** Callback invoked when transcription completes successfully. */
  onTranscriptReady: (text: string) => void;
}

/**
 * Uploads a recorded audio file for speech-to-text transcription.
 *
 * @param audioUri - Temporary URI for the recorded `.m4a` audio file.
 * @param languageCode - ISO language code selected for transcription.
 * @returns Transcript text returned by the transcription service.
 */
async function uploadAudioForTranscription(
  audioUri: string,
  languageCode: LanguageCode
): Promise<string> {
  // TODO: Implement audio upload and transcription in Prompt 1.2.
  throw new Error(
    `Transcription upload is not implemented for ${audioUri} (${languageCode}).`
  );
}

/**
 * Renders a hold-to-speak recording screen with language selection and waveform feedback.
 *
 * @param props - Screen props containing visit ownership and transcript callback data.
 * @returns A React Native voice input screen.
 */
export default function VoiceInputScreen({
  patientId,
  ashaId,
  onTranscriptReady
}: VoiceInputScreenProps) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [selectedLanguageCode, setSelectedLanguageCode] =
    useState<LanguageCode>("hi");
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [waveformValues, setWaveformValues] = useState([0.2, 0.4, 0.3, 0.5, 0.25]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isStartingRecordingRef = useRef(false);
  const pulseValue = useRef(new Animated.Value(1)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const shouldStopWhenReadyRef = useRef(false);

  const isRecording = status === "listening";
  const isProcessing = status === "processing";
  const selectedLanguage = LANGUAGES.find(
    (language) => language.code === selectedLanguageCode
  );

  useEffect(() => {
    if (!isRecording) {
      setWaveformValues([0.2, 0.4, 0.3, 0.5, 0.25]);
      return undefined;
    }

    const intervalId = setInterval(() => {
      setWaveformValues(Array.from({ length: 5 }, () => Math.random()));
    }, 100);

    return () => clearInterval(intervalId);
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) {
      pulseValue.stopAnimation();
      pulseValue.setValue(1);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          duration: 650,
          easing: Easing.out(Easing.ease),
          toValue: 1.15,
          useNativeDriver: true
        }),
        Animated.timing(pulseValue, {
          duration: 650,
          easing: Easing.in(Easing.ease),
          toValue: 1,
          useNativeDriver: true
        })
      ])
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [isRecording, pulseValue]);

  /**
   * Requests microphone access and starts a new temporary audio recording.
   */
  async function startRecording() {
    if (isProcessing || isStartingRecordingRef.current || recordingRef.current) {
      return;
    }

    try {
      setErrorMessage(null);
      setIsLanguageMenuOpen(false);
      isStartingRecordingRef.current = true;
      shouldStopWhenReadyRef.current = false;

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Microphone permission is required to record audio.");
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = newRecording;
      setStatus("listening");

      if (shouldStopWhenReadyRef.current) {
        await stopRecording(newRecording);
      }
    } catch (error) {
      setStatus("idle");
      setErrorMessage(getErrorMessage(error));
    } finally {
      isStartingRecordingRef.current = false;
    }
  }

  /**
   * Stops the active recording and sends the captured audio for transcription.
   *
   * @param recordingToStop - Recording instance that should be finalized.
   */
  async function stopRecording(recordingToStop = recordingRef.current) {
    if (!recordingToStop) {
      if (!isStartingRecordingRef.current) {
        setStatus("idle");
      }
      return;
    }

    try {
      shouldStopWhenReadyRef.current = false;
      setStatus("processing");
      await recordingToStop.stopAndUnloadAsync();
      const audioUri = recordingToStop.getURI();
      recordingRef.current = null;

      if (!audioUri) {
        throw new Error("No audio file was created for this recording.");
      }

      const transcriptText = await uploadAudioForTranscription(
        audioUri,
        selectedLanguageCode
      );
      onTranscriptReady(transcriptText);
      setStatus("idle");
    } catch (error) {
      recordingRef.current = null;
      setStatus("idle");
      setErrorMessage(getErrorMessage(error));
    }
  }

  /**
   * Selects a transcription language and closes the dropdown menu.
   *
   * @param languageCode - ISO language code selected by the user.
   */
  function selectLanguage(languageCode: LanguageCode) {
    setSelectedLanguageCode(languageCode);
    setIsLanguageMenuOpen(false);
  }

  /**
   * Starts recording in response to the user holding the mic button.
   */
  function handlePressIn() {
    shouldStopWhenReadyRef.current = false;
    void startRecording();
  }

  /**
   * Stops recording in response to the user releasing the mic button.
   */
  function handlePressOut() {
    shouldStopWhenReadyRef.current = true;
    void stopRecording();
  }

  return (
    <View style={styles.container}>
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.languageSelector}>
        <Text style={styles.fieldLabel}>Language</Text>
        <Pressable
          accessibilityRole="button"
          disabled={isRecording || isProcessing}
          onPress={() => setIsLanguageMenuOpen((isOpen) => !isOpen)}
          style={({ pressed }) => [
            styles.dropdownButton,
            pressed ? styles.dropdownButtonPressed : null,
            isRecording || isProcessing ? styles.dropdownButtonDisabled : null
          ]}
        >
          <Text style={styles.dropdownButtonText}>
            {selectedLanguage?.label ?? "Hindi"}
          </Text>
          <Text style={styles.dropdownChevron}>v</Text>
        </Pressable>

        {isLanguageMenuOpen ? (
          <View style={styles.dropdownMenu}>
            {LANGUAGES.map((language) => (
              <Pressable
                accessibilityRole="button"
                key={language.code}
                onPress={() => selectLanguage(language.code)}
                style={({ pressed }) => [
                  styles.dropdownItem,
                  selectedLanguageCode === language.code
                    ? styles.dropdownItemSelected
                    : null,
                  pressed ? styles.dropdownItemPressed : null
                ]}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    selectedLanguageCode === language.code
                      ? styles.dropdownItemTextSelected
                      : null
                  ]}
                >
                  {language.label}
                </Text>
                <Text style={styles.languageCode}>{language.code}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.recorderPanel}>
        <Text style={styles.patientContext}>
          Patient {patientId} - ASHA {ashaId}
        </Text>

        <View style={styles.waveform}>
          {waveformValues.map((value, index) => (
            <View
              key={index}
              style={[
                styles.waveformBar,
                isRecording ? styles.waveformBarActive : null,
                { height: 14 + value * 54 }
              ]}
            />
          ))}
        </View>

        <View style={styles.micControl}>
          <Animated.View
            style={[
              styles.micPulse,
              isRecording
                ? {
                    opacity: pulseValue.interpolate({
                      inputRange: [1, 1.15],
                      outputRange: [0.28, 0]
                    }),
                    transform: [{ scale: pulseValue }]
                  }
                : null
            ]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isProcessing}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={({ pressed }) => [
              styles.micButton,
              isRecording ? styles.micButtonRecording : null,
              pressed ? styles.micButtonPressed : null,
              isProcessing ? styles.micButtonDisabled : null
            ]}
          >
            {isProcessing ? (
              <ActivityIndicator color="#ffffff" size="large" />
            ) : (
              <Text style={styles.micIcon}>Mic</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.statusText}>{getStatusText(status)}</Text>
      </View>
    </View>
  );
}

/**
 * Converts recording state into the status copy shown on screen.
 *
 * @param status - Current recording workflow state.
 * @returns Human-readable recording status text.
 */
function getStatusText(status: RecordingStatus): string {
  if (status === "listening") {
    return "Listening...";
  }

  if (status === "processing") {
    return "Processing...";
  }

  return "Hold to speak";
}

/**
 * Normalizes unknown thrown values into displayable error messages.
 *
 * @param error - Unknown error thrown during recording or transcription.
 * @returns Message suitable for the error banner.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8fafc",
    flex: 1,
    padding: 24
  },
  dropdownButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14
  },
  dropdownButtonDisabled: {
    opacity: 0.55
  },
  dropdownButtonPressed: {
    backgroundColor: "#f1f5f9"
  },
  dropdownButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600"
  },
  dropdownChevron: {
    color: "#475569",
    fontSize: 16,
    fontWeight: "700"
  },
  dropdownItem: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 14
  },
  dropdownItemPressed: {
    backgroundColor: "#e2e8f0"
  },
  dropdownItemSelected: {
    backgroundColor: "#dcfce7"
  },
  dropdownItemText: {
    color: "#111827",
    fontSize: 15
  },
  dropdownItemTextSelected: {
    color: "#166534",
    fontWeight: "700"
  },
  dropdownMenu: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 4,
    marginTop: 8,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: {
      height: 8,
      width: 0
    },
    shadowOpacity: 0.12,
    shadowRadius: 18
  },
  errorBanner: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    padding: 12
  },
  errorText: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "600"
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase"
  },
  languageCode: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700"
  },
  languageSelector: {
    zIndex: 2
  },
  micButton: {
    alignItems: "center",
    backgroundColor: "#047857",
    borderRadius: 80,
    elevation: 8,
    height: 160,
    justifyContent: "center",
    shadowColor: "#064e3b",
    shadowOffset: {
      height: 10,
      width: 0
    },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    width: 160
  },
  micButtonDisabled: {
    backgroundColor: "#94a3b8"
  },
  micButtonPressed: {
    transform: [
      {
        scale: 0.98
      }
    ]
  },
  micButtonRecording: {
    backgroundColor: "#dc2626"
  },
  micControl: {
    alignItems: "center",
    height: 184,
    justifyContent: "center",
    width: 184
  },
  micIcon: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800"
  },
  micPulse: {
    backgroundColor: "#dc2626",
    borderRadius: 92,
    height: 184,
    opacity: 0,
    position: "absolute",
    width: 184
  },
  patientContext: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 28
  },
  recorderPanel: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    zIndex: 1
  },
  statusText: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 28
  },
  waveform: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    height: 78,
    justifyContent: "center",
    marginBottom: 36
  },
  waveformBar: {
    backgroundColor: "#94a3b8",
    borderRadius: 8,
    width: 12
  },
  waveformBarActive: {
    backgroundColor: "#047857"
  }
});
