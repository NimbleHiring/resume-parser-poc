import { ResumeExtractor } from "./extractors";
import { LLMProvider } from "./providers";

async function handleRequest(request: Request): Promise<Response> {
  const data = await request.arrayBuffer();

  const extractor = new ResumeExtractor(data);
  const text = await extractor.extractTextData();

  const llmProvider = new LLMProvider();
  const prompt = llmProvider.constructPrompt(text);
  const response = await llmProvider.sendPrompt(prompt);
  const output = llmProvider.getResponseText(response);


  return new Response(JSON.stringify(output), {
    headers: { 'Content-Type': 'application/json' }
  })
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method !== 'POST')
      return new Response('Method Not Allowed', { status: 405 })

    return handleRequest(request);
	},
} satisfies ExportedHandler<Env>;