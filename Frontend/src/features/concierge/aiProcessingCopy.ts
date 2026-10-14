import type {
  AiProcessingDisclosure,
  AssistantProcessing,
  ConciergeLocale,
  SpeechProcessing,
} from './types';

/**
 * The privacy notice's sentences on where a guest's words are processed, written from what the
 * server reports it is configured to use (GET /api/concierge/status, `aiProcessing`). A fixed
 * claim went false as soon as the provider changed, which breaks Privacy Act 2020 IPP 3 and Fair
 * Trading Act s 13, so nothing here names a service the server did not report.
 *
 * Until the status is read (or when it cannot be), the notice says the details are loading rather
 * than guess. "We do not use your messages to train AI models" is a statement about Wagstay's own
 * conduct; what each provider does with inputs is set by its own terms and is not promised here.
 */

export interface AiProcessingCopy {
  /** The assistant sentence while the status is loading or could not be read. */
  loading: string;
  /** The voice sentence under the message box while the status is loading. */
  voiceLoading: string;
  assistant: (assistant: AssistantProcessing) => string;
  speech: (speech: SpeechProcessing) => string;
  cards: string;
  noTraining: string;
  /** How this language strings sentences together: a space in English, nothing in Chinese. */
  sentenceSeparator: string;
}

/** Region names a guest recognises; any other region is shown as its code. */
const REGION_NAMES: Record<string, Record<ConciergeLocale, string>> = {
  'ap-southeast-2': { en: 'Sydney, Australia', zh: '澳大利亚悉尼' },
  'ap-southeast-4': { en: 'Melbourne, Australia', zh: '澳大利亚墨尔本' },
  'ap-southeast-6': { en: 'Auckland, New Zealand', zh: '新西兰奥克兰' },
  'us-east-1': { en: 'N. Virginia, United States', zh: '美国弗吉尼亚北部' },
  'us-east-2': { en: 'Ohio, United States', zh: '美国俄亥俄' },
  'us-west-2': { en: 'Oregon, United States', zh: '美国俄勒冈' },
};

export const regionName = (region: string, locale: ConciergeLocale): string =>
  REGION_NAMES[region]?.[locale] ??
  (locale === 'zh' ? `AWS 区域 ${region}` : `the AWS region ${region}`);

const EN: AiProcessingCopy = {
  loading: 'Details of where the assistant runs are loading.',
  voiceLoading: 'Details of where voice-to-text runs are loading.',
  assistant: ({ kind, region }) => {
    switch (kind) {
      case 'rules':
        return 'Answers come from our booking rules; no AI model reads your messages.';
      case 'bedrock':
        return region
          ? `The assistant runs on Amazon Bedrock in ${regionName(region, 'en')}.`
          : 'The assistant runs on Amazon Bedrock.';
      case 'anthropic':
        return 'The assistant runs on Anthropic’s Claude service in the United States.';
      case 'other':
        return 'The assistant runs on an AI service Wagstay has chosen; ask our team where it is hosted.';
    }
  },
  speech: ({ kind, region }) => {
    switch (kind) {
      case 'whisper':
        return 'Voice is turned into text on our own server and the audio is not kept.';
      case 'transcribe':
        return region
          ? `Voice is turned into text by Amazon Transcribe in ${regionName(region, 'en')}; the audio is not kept by Wagstay.`
          : 'Voice is turned into text by Amazon Transcribe; the audio is not kept by Wagstay.';
      case 'off':
        return 'Voice typing is not available right now.';
    }
  },
  cards: 'Card details go directly to Stripe; Wagstay does not store your full card number.',
  noTraining: 'We do not use your messages to train AI models.',
  sentenceSeparator: ' ',
};

const ZH: AiProcessingCopy = {
  loading: '助手运行位置的说明正在加载。',
  voiceLoading: '语音转文字运行位置的说明正在加载。',
  assistant: ({ kind, region }) => {
    switch (kind) {
      case 'rules':
        return '回答来自我们的预约规则，没有 AI 模型读取你的消息。';
      case 'bedrock':
        return region
          ? `助手运行在位于${regionName(region, 'zh')}的 Amazon Bedrock 上。`
          : '助手运行在 Amazon Bedrock 上。';
      case 'anthropic':
        return '助手运行在位于美国的 Anthropic Claude 服务上。';
      case 'other':
        return '助手运行在 Wagstay 选定的 AI 服务上，想知道它在哪里运行可以联系我们。';
    }
  },
  speech: ({ kind, region }) => {
    switch (kind) {
      case 'whisper':
        return '语音在我们自己的服务器上转成文字，音频不会保存。';
      case 'transcribe':
        return region
          ? `语音由位于${regionName(region, 'zh')}的 Amazon Transcribe 转成文字，Wagstay 不保存音频。`
          : '语音由 Amazon Transcribe 转成文字，Wagstay 不保存音频。';
      case 'off':
        return '语音输入现在不可用。';
    }
  },
  cards: '银行卡信息直接交给 Stripe，Wagstay 不保存完整卡号。',
  noTraining: '我们不会用你的消息训练 AI 模型。',
  sentenceSeparator: '',
};

export const AI_PROCESSING_COPY: Record<ConciergeLocale, AiProcessingCopy> = { en: EN, zh: ZH };

/** The privacy notice line: where the assistant and voice-to-text run, cards, and training. */
export const describeAiProcessing = (
  copy: AiProcessingCopy,
  disclosure: AiProcessingDisclosure | null,
): string => {
  const processing = disclosure
    ? [
        ...(disclosure.assistant ? [copy.assistant(disclosure.assistant)] : []),
        copy.speech(disclosure.speech),
      ]
    : [copy.loading];
  return [...processing, copy.cards, copy.noTraining].join(copy.sentenceSeparator);
};

/** The line under the message box about voice typing. */
export const describeVoiceProcessing = (
  copy: AiProcessingCopy,
  speech: SpeechProcessing | null,
): string => (speech ? copy.speech(speech) : copy.voiceLoading);
