import { downsampleToPcm16 } from './pcm';

/**
 * Pulls raw samples off a microphone `MediaStream` and delivers them as 16-bit PCM chunks.
 *
 * An `AudioWorklet` runs on the audio thread and is the supported way to read samples; the
 * deprecated `ScriptProcessorNode` is kept only as a fallback for browsers without worklets. The
 * worklet source lives in this file as a string so Vite serves it without a separate asset and the
 * bundle stays a single graph.
 */

export interface PcmCaptureHandle {
  stop: () => Promise<void>;
}

export interface PcmCaptureOptions {
  stream: MediaStream;
  targetSampleRate: number;
  onChunk: (chunk: Int16Array) => void;
}

const WORKLET_PROCESSOR_NAME = 'pcm-capture-processor';

/*
 * Blocks arrive 128 frames at a time; posting each one would be ~375 messages a second. They are
 * merged to roughly 2048 frames (about 43 ms at 48 kHz) before crossing to the main thread.
 */
const WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = [];
    this.pendingLength = 0;
    this.flushAt = 2048;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) {
      return true;
    }
    this.pending.push(new Float32Array(channel));
    this.pendingLength += channel.length;
    if (this.pendingLength >= this.flushAt) {
      const merged = new Float32Array(this.pendingLength);
      let offset = 0;
      for (const block of this.pending) {
        merged.set(block, offset);
        offset += block.length;
      }
      this.port.postMessage(merged, [merged.buffer]);
      this.pending = [];
      this.pendingLength = 0;
    }
    return true;
  }
}

registerProcessor('${WORKLET_PROCESSOR_NAME}', PcmCaptureProcessor);
`;

let workletModuleUrl: string | null = null;

const getWorkletModuleUrl = (): string => {
  if (!workletModuleUrl) {
    workletModuleUrl = URL.createObjectURL(
      new Blob([WORKLET_SOURCE], { type: 'application/javascript' }),
    );
  }
  return workletModuleUrl;
};

const supportsAudioWorklet = (context: AudioContext): boolean =>
  typeof AudioWorkletNode !== 'undefined' && Boolean(context.audioWorklet);

export const startPcmCapture = async ({
  stream,
  targetSampleRate,
  onChunk,
}: PcmCaptureOptions): Promise<PcmCaptureHandle> => {
  const context = new AudioContext();
  // The microphone button click is the user gesture; resuming here satisfies autoplay policy.
  await context.resume();

  const source = context.createMediaStreamSource(stream);
  // A silent sink keeps the graph "connected" so browsers keep processing it, without playback.
  const sink = context.createGain();
  sink.gain.value = 0;
  sink.connect(context.destination);

  const deliver = (samples: Float32Array): void => {
    onChunk(downsampleToPcm16(samples, context.sampleRate, targetSampleRate));
  };

  let node: AudioNode;
  let detach: () => void;

  if (supportsAudioWorklet(context)) {
    await context.audioWorklet.addModule(getWorkletModuleUrl());
    const worklet = new AudioWorkletNode(context, WORKLET_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
    });
    worklet.port.onmessage = (event: MessageEvent<Float32Array>): void => deliver(event.data);
    node = worklet;
    detach = (): void => {
      worklet.port.onmessage = null;
    };
  } else {
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event: AudioProcessingEvent): void => {
      // The buffer is reused by the browser, so copy before handing it on.
      deliver(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    node = processor;
    detach = (): void => {
      processor.onaudioprocess = null;
    };
  }

  source.connect(node);
  node.connect(sink);

  return {
    stop: async (): Promise<void> => {
      detach();
      source.disconnect();
      node.disconnect();
      sink.disconnect();
      if (context.state !== 'closed') {
        await context.close();
      }
    },
  };
};
