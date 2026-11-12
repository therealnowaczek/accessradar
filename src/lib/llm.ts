import type { Message } from '@forge/llm';

/**
 * The only door to a language model: Forge LLMs (Runs on Atlassian). No external provider, no egress,
 * no API key. The prompt content is built by domain/presort.ts and is minimised there.
 */
const FALLBACK_MODEL = 'claude-sonnet-4-20250514';

async function pickModel(): Promise<string> {
  try {
    const { list } = await import('@forge/llm');
    const { models } = await list();
    const active = models.filter((m) => m.status === 'active' && /sonnet/i.test(m.model));
    return active[0]?.model ?? FALLBACK_MODEL;
  } catch {
    return FALLBACK_MODEL;
  }
}

export async function askForgeLlm(messages: Message[]): Promise<{ text: string; model: string }> {
  const { chat } = await import('@forge/llm');
  const model = await pickModel();
  const res = await chat({
    model,
    messages,
    temperature: 0,
    max_completion_tokens: 4000,
  });
  const content = res.choices?.[0]?.message?.content ?? '';
  const text =
    typeof content === 'string'
      ? content
      : content.map((c) => (c.type === 'text' ? c.text : '')).join('');
  return { text, model };
}
