/**
 * Microphone capture wrapper around `expo-av`.
 *
 * Records in 16 kHz mono PCM/WAV — the format Sarvam Saarika STT requires.
 * HIGH_QUALITY preset uses M4A/AAC which Sarvam rejects.
 */

import { Audio } from "expo-av";

export interface ActiveRecording {
  recording: Audio.Recording;
  startedAt: number;
}

// 16 kHz mono PCM — accepted by Sarvam Saarika and most cloud STT APIs.
const SPEECH_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: ".wav",
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: ".wav",
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};

export async function ensureMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === "granted";
}

export async function startRecording(): Promise<ActiveRecording> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(SPEECH_RECORDING_OPTIONS);
  await recording.startAsync();
  return { recording, startedAt: Date.now() };
}

export async function stopRecording(active: ActiveRecording): Promise<{
  uri: string;
  durationMs: number;
}> {
  await active.recording.stopAndUnloadAsync();
  const uri = active.recording.getURI();
  const durationMs = Date.now() - active.startedAt;
  if (!uri) {
    throw new Error("Recording produced no audio file.");
  }
  return { uri, durationMs };
}
