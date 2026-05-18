import ZAI from 'z-ai-web-dev-sdk';

type ChatRole = 'system' | 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatCompletionParams = {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: unknown;
  thinking?: unknown;
  [key: string]: unknown;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function normalizeMessages(messages: Array<{ role: string; content: string }>): ChatMessage[] {
  return messages.map((message, index) => {
    const role = message.role === 'system' || message.role === 'user' || message.role === 'assistant'
      ? message.role
      : 'user';

    // Existing code often used the first assistant message as a system instruction.
    // DeepSeek/OpenAI-compatible APIs behave better when this is sent as `system`.
    if (index === 0 && role === 'assistant') {
      return { role: 'system', content: message.content };
    }

    return { role, content: message.content };
  });
}

export async function chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (apiKey) {
    const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    const body: Record<string, unknown> = {
      ...params,
      model: params.model || model,
      messages: normalizeMessages(params.messages || []),
    };

    // z-ai specific option; DeepSeek's OpenAI-compatible endpoint does not accept it.
    delete body.thinking;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      // Number(env) || default evita NaN quando a env for string invalida (ex: 'undefined', '')
      signal: AbortSignal.timeout(Number(process.env.DEEPSEEK_TIMEOUT_MS) || 180_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`DeepSeek API failed: ${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 500)}` : ''}`);
    }

    return response.json() as Promise<ChatCompletionResponse>;
  }

  // Local/dev fallback while DEEPSEEK_API_KEY is not configured.
  const zai = await ZAI.create();
  const normalizedParams = {
    ...params,
    messages: normalizeMessages(params.messages || []),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return zai.chat.completions.create(normalizedParams as any) as Promise<ChatCompletionResponse>;
}
