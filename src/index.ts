import { ResumeExtractor } from "./extractors";
import { LLMProvider, S3Provider } from "./providers";

interface RequestBody {
  resumeKey: string;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {;
  const overallStart = performance.now();
  
  const body = (await request.json()) as RequestBody;
  const resumePath = body.resumeKey;

  const s3Start = performance.now();
  const s3Client = new S3Provider(env);
  const bucket = env.RESUME_BUCKET!;
  const resumeData = await s3Client.getFileArrayBuffer(bucket, resumePath);
  const presignedUrl = await s3Client.getPresignedUrl(bucket, resumePath);
  console.log(`Presigned URL: ${presignedUrl}`);
  const s3End = performance.now();
  const s3Time = s3End - s3Start;
  console.log(`S3 retrieval time: ${s3Time.toFixed(2)}ms`);

  const extractStart = performance.now();
  const resumePathParts = resumePath.split('.');
  const fileType = resumePathParts[resumePathParts.length - 1] as 'pdf' | 'docx';
  const extractor = new ResumeExtractor(fileType);
  const text = await extractor.extractTextData(resumeData);
  const extractEnd = performance.now();
  const extractTime = extractEnd - extractStart;
  console.log(`Text extraction time: ${extractTime.toFixed(2)}ms`);

  const llmStart = performance.now();
  const llmProvider = new LLMProvider(env);
  const prompt = llmProvider.constructPrompt(text);
  const response = await llmProvider.sendPrompt(prompt);
  const output = llmProvider.getResponseText(response);
  const llmEnd = performance.now();
  const llmTime = llmEnd - llmStart;
  console.log(`LLM processing time: ${llmTime.toFixed(2)}ms`);

  const overallEnd = performance.now();
  const overallTime = overallEnd - overallStart;
  console.log(`Total processing time: ${overallTime.toFixed(2)}ms`);
  
  return new Response(output, {
    headers: { 'Content-Type': 'application/json' }
  });
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
    console.log('Request received:', request.method, request.url);
    const url = new URL(request.url);
    const path = url.pathname;
    switch (path) {
      case '/api/resume':
        return handleRequest(request, env);
      default:
        console.log('Invalid path:', path);
        return new Response('Not Found', { status: 404 });
    }
	},
} satisfies ExportedHandler<Env>;