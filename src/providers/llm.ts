import OpenAI, { ClientOptions as OpenAIClientOptions } from "openai";
import Anthropic, { ClientOptions as AnthropicClientOptions } from "@anthropic-ai/sdk";
import { ContentBlock } from "@anthropic-ai/sdk/resources/index.mjs";
import { basePrompt } from "../prompts";

type LLMResponse = OpenAI.Responses.Response | Anthropic.Message;

type OpenAIPrompt = {
  instructions: string;
  input: string;
}

type Prompt = OpenAIPrompt | Anthropic.Messages.MessageCreateParamsNonStreaming;

interface LLMClient<T extends Prompt = Prompt, U extends LLMResponse = LLMResponse> {
  constructPrompt(extractedData: string): T;
  sendMessage(prompt: T): Promise<U>;
  validateResponse(response: U): boolean;
  getResponseText(response: U): string;
}


class OpenAIClient implements LLMClient<OpenAIPrompt, OpenAI.Responses.Response> {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIClientOptions, model: string) {
    this.client = new OpenAI(config);
    this.model = model;
  }

  constructPrompt(extractedData: string): OpenAIPrompt {
    return {
      instructions: basePrompt,
      input: extractedData,
    }
  }

  async sendMessage(prompt: OpenAIPrompt): Promise<OpenAI.Responses.Response> {
    return this.client.responses.create({
      model: this.model,
      instructions: prompt.instructions,
      input: prompt.input,
    });
  }

  validateResponse(response: OpenAI.Responses.Response): boolean {
    if (!response.error) return true;
    console.error(response.error);
    return false;
  }

  getResponseText(response: OpenAI.Responses.Response): string {
    return response.output_text;
  }
}

class AnthropicClient implements LLMClient<Anthropic.Messages.MessageCreateParamsNonStreaming, Anthropic.Message> {
  private client: Anthropic;
  private model: string;

  constructor(config: AnthropicClientOptions, model: string) {
    this.client = new Anthropic(config);
    this.model = model;
  }

  constructPrompt(extractedData: string): Anthropic.Messages.MessageCreateParamsNonStreaming {
    return {
      max_tokens: 2048,
      messages: [{ role: 'user', content: basePrompt + `\nHere is the resume data:\n` + extractedData }],
      model: this.model,
    }
  }

  async sendMessage(prompt: Anthropic.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    return await this.client.messages.create(prompt);
  }

  validateResponse(response: Anthropic.Message): boolean {
    const blocks: ContentBlock[] = response.content;
    let responseIncludesTextBlocks = false;
    for (const block of blocks) {
      if (block.type === 'text') {
        responseIncludesTextBlocks = true;
      }
    }
    
    if (!responseIncludesTextBlocks) {
      console.error("No text in response");
      return false;
    }

    return true;
  }

  getResponseText(response: Anthropic.Message): string {
    const blocks: ContentBlock[] = response.content;
    let responseText = "";
    for (const block of blocks) {
      if (block.type === 'text') {
        responseText += block.text;
      }
    }
    return responseText;
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
      case "anthropic":
        return new AnthropicClient({
          apiKey: process.env.ANTHROPIC_API_KEY,
        }, 'claude-3-5-sonnet-latest');
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