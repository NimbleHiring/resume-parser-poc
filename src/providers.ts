import OpenAI, { ClientOptions } from "openai";

type LLMResponse = OpenAI.Responses.Response;

type Prompt = {
  instructions: string;
  input: string;
}
interface LLMClient {
    sendMessage(message: Prompt): Promise<LLMResponse>;
    validateResponse(response: LLMResponse): boolean;
    getResponseText(response: LLMResponse): string;
}


class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(config: ClientOptions, model: string) {
    this.client = new OpenAI(config);
    this.model = model;
  }

  async sendMessage(message: Prompt): Promise<LLMResponse> {
    return this.client.responses.create({
      model: this.model,
      instructions: message.instructions,
      input: message.input,
    });
  }

  validateResponse(response: LLMResponse): boolean {
    if (!response.error) return true;
    console.error(response.error);
    return false;
  }

  getResponseText(response: OpenAI.Responses.Response): string {
    return response.output_text;
  }
}

export class LLMProvider {
  private client: LLMClient | null = null;
  private provider: string = process.env.LLM_PROVIDER || "openai";

  private createClient(): LLMClient {
    switch (this.provider) {
      case "openai":
        return new OpenAIClient({
          apiKey: process.env.OPENAI_API_KEY,
        }, 'gpt-4o');
      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  private getClient(): LLMClient {
    if (!this.client) {
      const client = this.createClient();
      this.client = client;
    }

    return this.client;
  }

  async sendPrompt(message: Prompt): Promise<LLMResponse> {
    const client = this.getClient();
    return client.sendMessage(message);
  }

  getResponseText(response: LLMResponse): string {
    const client = this.getClient();
    return client.getResponseText(response);
  }
}