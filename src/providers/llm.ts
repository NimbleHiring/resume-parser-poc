import OpenAI, { ClientOptions as OpenAIClientOptions } from "openai";
import Anthropic, { ClientOptions as AnthropicClientOptions } from "@anthropic-ai/sdk";
import { ContentBlock } from "@anthropic-ai/sdk/resources/index.mjs";
import { basePrompt } from "../prompts";
import { GenerateContentParameters, GenerateContentResponse, GoogleGenAI, GoogleGenAIOptions } from "@google/genai";

type LLMResponse = OpenAI.Responses.Response | Anthropic.Message | GenerateContentResponse;

type OpenAIPrompt = {
  instructions: string;
  input: string;
}

type Prompt = OpenAIPrompt | Anthropic.Messages.MessageCreateParamsNonStreaming | GenerateContentParameters;

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
      max_tokens: 4096,
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

class GeminiClient implements LLMClient<GenerateContentParameters, GenerateContentResponse> {
  private client: GoogleGenAI;
  private model: string;

  constructor(config: GoogleGenAIOptions, model: string) {
    this.client = new GoogleGenAI(config);
    this.model = model;
  }

  constructPrompt(extractedData: string): GenerateContentParameters {
    return {
      contents: basePrompt + `\nHere is the resume data:\n` + extractedData,
      model: this.model,
    }
  }

  async sendMessage(prompt: GenerateContentParameters): Promise<GenerateContentResponse> {
    return await this.client.models.generateContent(prompt);
  }

  validateResponse(response: GenerateContentResponse): boolean {
    if (!response.text) {
      console.error("No text in response");
      return false;
    }

    return true;
  }

  getResponseText(response: GenerateContentResponse): string {
    return response.text as string;
  }
}

export class LLMProvider {
  private client: LLMClient | null = null;
  private model: string;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.model = env.LLM_MODEL || "gpt-4o";
  }

  private createClient(): LLMClient {
    const modelProvider = this.model.split("-")[0];
    switch (modelProvider) {
      case "gpt":
        return new OpenAIClient({
          apiKey: this.env.OPENAI_API_KEY,
        }, this.model);
      case "claude":
        return new AnthropicClient({
          apiKey: this.env.ANTHROPIC_API_KEY,
        }, this.model);
      case "gemini":
        return new GeminiClient({
          apiKey: this.env.GEMINI_API_KEY,
        }, this.model);
      default:
        throw new Error(`Unsupported LLM model: ${this.model}`);
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
    const start = performance.now();
    const client = this.getClient();
    const response = client.sendMessage(message);
    const end = performance.now();
    const time = end - start;
    console.log(`LLM processing time: ${time.toFixed(2)}ms`);
    return response;
  }

  getResponseText(response: LLMResponse): string {
    const client = this.getClient();
    if (!client.validateResponse(response)) {
      throw new Error("Invalid response");
    }
    return client.getResponseText(response);
  }

  constructPrompt(extractedData: string): Prompt {
    const client = this.getClient();
    return client.constructPrompt(extractedData);
  }
}