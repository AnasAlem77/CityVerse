import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGenerationInput, AiProvider } from './ai-provider';

@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  constructor(private readonly config: ConfigService) {}
  capabilities() { return { provider: this.config.get('AI_PROVIDER', 'openai-compatible'), structured: true }; }
  async generateStructured(input: AiGenerationInput) {
    const key = this.config.get<string>('AI_API_KEY');
    const url = this.config.get('AI_BASE_URL', 'https://api.openai.com/v1') + '/chat/completions';
    if (!key) throw new Error('AI provider is not configured');
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.config.get('AI_MODEL', 'gpt-4o-mini'), temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: input.system }, { role: 'user', content: `${input.user}\n\nVERIFIED CITYVERSE CONTEXT:\n${JSON.stringify(input.context)}` }] }) });
      if (!response.ok) throw new Error('AI provider unavailable');
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    } finally { clearTimeout(timeout); }
  }
}
