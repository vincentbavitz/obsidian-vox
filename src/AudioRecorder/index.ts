import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";

type RecordingState = "idle" | "recording" | "paused";

export type AudioRecorderState = {
  recordingState: RecordingState;
  blob: Blob | null;
};

type StateSubscriberMap = Record<string, (state: AudioRecorderState) => void>;

/**
 * A class to handle recording audio from a selected input device.
 */
export default class AudioRecorder {
  private mediaRecorder!: MediaRecorder;
  private audioChunks: BlobPart[] = [];
  private audioBlobPromise!: Promise<Blob>;
  private stream!: MediaStream;

  private subscribers: StateSubscriberMap = {};
  public state: AudioRecorderState;

  constructor() {
    this.state = {
      recordingState: "idle",
      blob: null,
    };
  }

  /**
   * Retrieves a list of available audio input devices (microphones).
   * @returns A promise that resolves to an array of input devices.
   */
  public async getInputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "audioinput");
  }

  /**
   * Requests access to the microphone of the selected device and starts recording.
   * @param deviceId The device ID of the selected input device.
   * @returns A promise that resolves when recording starts.
   */
  public async record(preferredDeviceId?: string | null): Promise<void> {
    this.state.blob = null;

    const devices = await this.getInputDevices();
    const isPreferredDeviceAvailable = preferredDeviceId && devices.map((s) => s.deviceId).includes(preferredDeviceId);

    // Request microphone access for the selected device
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: isPreferredDeviceAvailable ? { exact: preferredDeviceId } : undefined,
      },
    });

    // Initialize MediaRecorder and audio chunks array
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.audioChunks = [];

    // Capture audio data
    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      console.log("index ➡️ event.data:", event.data);
      this.audioChunks.push(event.data);
    };

    // Create a promise that resolves with the audio blob when recording is stopped
    this.audioBlobPromise = new Promise<Blob>((resolve) => {
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
        resolve(audioBlob);
      };
    });

    // Start recording
    this.mediaRecorder.start();

    this.state.recordingState = "recording";
    this.notifySubscribers();
  }

  /**
   * Stops the recording and returns the recorded audio blob.
   * @returns A promise that resolves to the Blob containing the recorded audio data.
   */
  public async stop(): Promise<Blob> {
    // Stop the MediaRecorder
    this.mediaRecorder.stop();
    this.state.recordingState = "idle";

    // Stop all media tracks to release the microphone
    this.stream.getTracks().forEach((track) => track.stop());

    // Return the promise with the recorded audio blob
    this.state.blob = await this.audioBlobPromise;
    this.notifySubscribers();

    return this.state.blob;
  }

  /**
   * Pauses the recording process.
   */
  public pause(): void {
    if (this.isRecording()) {
      this.state.recordingState = "paused";
      this.mediaRecorder.pause();
      this.notifySubscribers();
    }
  }

  /**
   * Resumes the recording process.
   */
  public resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.state.recordingState = "recording";
      this.mediaRecorder.resume();
      this.notifySubscribers();
    }
  }

  /**
   * Checks if the MediaRecorder is actively recording.
   * @returns A boolean indicating whether the recording is active.
   */
  public isRecording(): boolean {
    return this.mediaRecorder && this.mediaRecorder.state === "recording";
  }

  /**
   * Saves the audio blob as a file on the disk.
   * @param blob The recorded audio Blob.
   * @param filePath The path where the file should be saved.
   * @returns A promise that resolves when the file is saved.
   */
  public async saveBlobAsFile(blob: Blob, filePath: string): Promise<void> {
    const buffer = Buffer.from(await blob.arrayBuffer());
    await writeFile(filePath, buffer);
  }

  /**
   * Subscribe to updates on the audio recorder's state.
   */
  public subscribe(callback: (state: AudioRecorderState) => void) {
    const subscriberId = randomUUID();
    this.subscribers[subscriberId] = callback;

    // Return a function to unsubscribe
    return () => this.unsubscribe(subscriberId);
  }

  private unsubscribe(subscriberId: string) {
    delete this.subscribers[subscriberId];
  }

  /**
   * Run the callback for all of our current subscribers; updating them on our new state.
   */
  private notifySubscribers() {
    Object.values(this.subscribers).forEach((fn) => fn?.(this.state));
  }
}
