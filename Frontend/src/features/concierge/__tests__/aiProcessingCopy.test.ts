import { describe, expect, it } from 'vitest';
import {
  AI_PROCESSING_COPY,
  describeAiProcessing,
  describeVoiceProcessing,
  regionName,
} from '../aiProcessingCopy';
import { CONCIERGE_COPY } from '../copy';
import type {
  AiProcessingDisclosure,
  AssistantProcessing,
  ConciergeLocale,
  SpeechProcessing,
} from '../types';

const WHISPER: SpeechProcessing = { kind: 'whisper', region: null };
const PARENT_CHAT_LOCAL: AiProcessingDisclosure['parentChat'] = { kind: 'other', region: null };

const disclosure = (
  assistant: AssistantProcessing | null,
  speech: SpeechProcessing = WHISPER,
): AiProcessingDisclosure => ({ assistant, speech, parentChat: PARENT_CHAT_LOCAL });

// Built from its code point, so this file holds no em dash itself.
const EM_DASH = String.fromCharCode(0x2014);

describe('regionName', () => {
  it.each<[string, ConciergeLocale, string]>([
    ['ap-southeast-2', 'en', 'Sydney, Australia'],
    ['ap-southeast-2', 'zh', '澳大利亚悉尼'],
    ['ap-southeast-4', 'en', 'Melbourne, Australia'],
    ['ap-southeast-6', 'en', 'Auckland, New Zealand'],
    ['us-east-1', 'en', 'N. Virginia, United States'],
    ['us-east-2', 'en', 'Ohio, United States'],
    ['us-west-2', 'en', 'Oregon, United States'],
    ['us-west-2', 'zh', '美国俄勒冈'],
    ['eu-west-1', 'en', 'the AWS region eu-west-1'],
    ['eu-west-1', 'zh', 'AWS 区域 eu-west-1'],
  ])('names %s in %s as %s', (region, locale, name) => {
    expect(regionName(region, locale)).toBe(name);
  });
});

describe('describeAiProcessing in English', () => {
  const en = AI_PROCESSING_COPY.en;

  it.each<[string, AssistantProcessing, string]>([
    [
      'rules',
      { kind: 'rules', region: null },
      'Answers come from our booking rules; no AI model reads your messages.',
    ],
    [
      'bedrock in Sydney',
      { kind: 'bedrock', region: 'ap-southeast-2' },
      'The assistant runs on Amazon Bedrock in Sydney, Australia.',
    ],
    [
      'bedrock in an unnamed region',
      { kind: 'bedrock', region: 'eu-west-1' },
      'The assistant runs on Amazon Bedrock in the AWS region eu-west-1.',
    ],
    [
      'bedrock with no region',
      { kind: 'bedrock', region: null },
      'The assistant runs on Amazon Bedrock.',
    ],
    [
      'anthropic',
      { kind: 'anthropic', region: null },
      'The assistant runs on Anthropic’s Claude service in the United States.',
    ],
    [
      'another service',
      { kind: 'other', region: null },
      'The assistant runs on an AI service Wagstay has chosen; ask our team where it is hosted.',
    ],
  ])('names the assistant for %s', (_name, assistant, sentence) => {
    const line = describeAiProcessing(en, disclosure(assistant));

    expect(line).toBe(
      `${sentence} Voice is turned into text on our own server and the audio is not kept. Card details go directly to Stripe; Wagstay does not store your full card number. We do not use your messages to train AI models.`,
    );
  });

  it.each<[string, SpeechProcessing, string]>([
    ['whisper', WHISPER, 'Voice is turned into text on our own server and the audio is not kept.'],
    [
      'transcribe in Sydney',
      { kind: 'transcribe', region: 'ap-southeast-2' },
      'Voice is turned into text by Amazon Transcribe in Sydney, Australia; the audio is not kept by Wagstay.',
    ],
    [
      'transcribe with no region',
      { kind: 'transcribe', region: null },
      'Voice is turned into text by Amazon Transcribe; the audio is not kept by Wagstay.',
    ],
    ['off', { kind: 'off', region: null }, 'Voice typing is not available right now.'],
  ])('names voice-to-text for %s', (_name, speech, sentence) => {
    expect(describeAiProcessing(en, disclosure({ kind: 'rules', region: null }, speech))).toContain(
      sentence,
    );
    expect(describeVoiceProcessing(en, speech)).toBe(sentence);
  });

  it('makes no claim about where anything runs while the status is loading or unavailable', () => {
    const line = describeAiProcessing(en, null);

    expect(line).toBe(
      'Details of where the assistant runs are loading. Card details go directly to Stripe; Wagstay does not store your full card number. We do not use your messages to train AI models.',
    );
    expect(describeVoiceProcessing(en, null)).toBe(
      'Details of where voice-to-text runs are loading.',
    );
  });

  it('leaves the assistant out when the server does not know the provider', () => {
    expect(describeAiProcessing(en, disclosure(null))).toMatch(/^Voice is turned into text/);
  });
});

describe('describeAiProcessing in Chinese', () => {
  const zh = AI_PROCESSING_COPY.zh;

  it.each<[string, AssistantProcessing, string]>([
    [
      'rules',
      { kind: 'rules', region: null },
      '回答来自我们的预约规则，没有 AI 模型读取你的消息。',
    ],
    [
      'bedrock in Sydney',
      { kind: 'bedrock', region: 'ap-southeast-2' },
      '助手运行在位于澳大利亚悉尼的 Amazon Bedrock 上。',
    ],
    ['bedrock with no region', { kind: 'bedrock', region: null }, '助手运行在 Amazon Bedrock 上。'],
    [
      'anthropic',
      { kind: 'anthropic', region: null },
      '助手运行在位于美国的 Anthropic Claude 服务上。',
    ],
    [
      'another service',
      { kind: 'other', region: null },
      '助手运行在 Wagstay 选定的 AI 服务上，想知道它在哪里运行可以联系我们。',
    ],
  ])('names the assistant for %s', (_name, assistant, sentence) => {
    expect(describeAiProcessing(zh, disclosure(assistant))).toBe(
      `${sentence}语音在我们自己的服务器上转成文字，音频不会保存。银行卡信息直接交给 Stripe，Wagstay 不保存完整卡号。我们不会用你的消息训练 AI 模型。`,
    );
  });

  it.each<[string, SpeechProcessing, string]>([
    ['whisper', WHISPER, '语音在我们自己的服务器上转成文字，音频不会保存。'],
    [
      'transcribe in Melbourne',
      { kind: 'transcribe', region: 'ap-southeast-4' },
      '语音由位于澳大利亚墨尔本的 Amazon Transcribe 转成文字，Wagstay 不保存音频。',
    ],
    [
      'transcribe with no region',
      { kind: 'transcribe', region: null },
      '语音由 Amazon Transcribe 转成文字，Wagstay 不保存音频。',
    ],
    ['off', { kind: 'off', region: null }, '语音输入现在不可用。'],
  ])('names voice-to-text for %s', (_name, speech, sentence) => {
    expect(describeVoiceProcessing(zh, speech)).toBe(sentence);
  });

  it('makes no claim while the status is loading', () => {
    expect(describeAiProcessing(zh, null)).toMatch(/^助手运行位置的说明正在加载。/);
    expect(describeVoiceProcessing(zh, null)).toBe('语音转文字运行位置的说明正在加载。');
  });
});

describe('the privacy notice in the page copy', () => {
  it.each<ConciergeLocale>(['en', 'zh'])(
    'puts the processing line second in %s, and never the old fixed claim',
    (locale) => {
      const copy = CONCIERGE_COPY[locale];
      const status = disclosure({ kind: 'anthropic', region: null });
      const lines = copy.privacy.details(status);

      expect(lines[1]).toBe(describeAiProcessing(AI_PROCESSING_COPY[locale], status));
      expect(lines.join(' ')).not.toMatch(/Amazon Web Services|Nothing is used to train/);
      expect(copy.chat.voiceNotice(WHISPER)).toBe(
        describeVoiceProcessing(AI_PROCESSING_COPY[locale], WHISPER),
      );
    },
  );

  it('uses no em dash in any sentence', () => {
    const everySentence = (['en', 'zh'] as const).flatMap((locale) => {
      const copy = AI_PROCESSING_COPY[locale];
      return [
        describeAiProcessing(copy, null),
        ...(['rules', 'bedrock', 'anthropic', 'other'] as const).map((kind) =>
          describeAiProcessing(
            copy,
            disclosure(
              { kind, region: 'ap-southeast-2' },
              { kind: 'transcribe', region: 'eu-west-1' },
            ),
          ),
        ),
        describeVoiceProcessing(copy, { kind: 'off', region: null }),
      ];
    });

    expect(everySentence.join('')).not.toContain(EM_DASH);
  });
});
