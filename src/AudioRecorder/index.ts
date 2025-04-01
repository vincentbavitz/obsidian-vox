import { randomUUID } from "crypto";
import { AudioChunk } from "types";

type RecordingState = "idle" | "recording" | "paused";

type AudioData = {
  duration: number;
  blob: Blob | null;
  chunks: AudioChunk[];

  /**
   * The timestamp of the start of the current chunk
   */
  currentChunkStart: number | null;
};

export type AudioRecorderState = {
  recordingState: RecordingState;
  audio: AudioData;
};

type StateSubscriberMap = Record<string, (state: AudioRecorderState) => void>;

/**
 * A class to handle recording audio from a selected input device.
 */
export default class AudioRecorder {
  private mediaRecorder!: MediaRecorder;
  private audioBlobPromise!: Promise<Blob>;
  private stream!: MediaStream;

  private subscribers: StateSubscriberMap = {};
  public state: AudioRecorderState;

  constructor() {
    this.state = {
      recordingState: "idle",
      audio: {
        chunks: [],
        currentChunkStart: null,
        duration: 0,
        blob: null,
      },
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
    this.state.audio = {
      currentChunkStart: null,
      duration: 0,
      chunks: [],
      blob: null,
    };

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

    const syncCurrentStart = () => {
      this.state.audio.currentChunkStart = Date.now();
      this.notifySubscribers();
    };

    // Sync audio data on each start, resume, pause & error event.
    this.mediaRecorder.onstart = syncCurrentStart;
    this.mediaRecorder.onresume = syncCurrentStart;
    this.mediaRecorder.onpause = () => this.mediaRecorder.requestData();
    this.mediaRecorder.onerror = () => this.mediaRecorder.requestData();

    // Capture audio data on pause or stop.
    this.mediaRecorder.ondataavailable = async (event: BlobEvent) => {
      if (event.data.size === 0 || this.state.audio.currentChunkStart === null) {
        return;
      }

      const dataToThisPoint = this.state.audio.chunks.map((c) => c.blob).filter(Boolean) as Blob[];
      const blobToThisPoint = new Blob([...dataToThisPoint, event.data], { type: "audio/webm;codecs=opus" });
      const duration = await this.getBlobDuration(blobToThisPoint);

      this.state.audio.chunks.push({
        start: this.state.audio.currentChunkStart,
        stop: Date.now(),
        blob: event.data,
      });

      this.state.audio.duration = duration;
      this.state.audio.currentChunkStart = null;

      this.notifySubscribers();
    };

    // Create a promise that resolves with the audio blob when recording is stopped
    this.audioBlobPromise = new Promise<Blob>((resolve) => {
      this.mediaRecorder.onstop = () => {
        const data = this.state.audio.chunks.map((chunk) => chunk.blob);
        const audioBlob = new Blob(data, { type: "audio/webm;codecs=opus" });

        this.notifySubscribers();
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
    this.state.audio.blob = await this.audioBlobPromise;

    this.notifySubscribers();

    return this.state.audio.blob;
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
    // const buffer = Buffer.from(await blob.arrayBuffer());
    // await writeFile(filePath, buffer);
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

  private async getBlobDuration(blob: Blob) {
    const context = new AudioContext();
    const buffer = await blob.arrayBuffer();
    const audio = await context.decodeAudioData(buffer);
    context.close();

    return audio.duration;
  }
}
