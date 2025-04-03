import { ResumeExtractor } from "./extractors";
import { LLMProvider, S3Provider } from "./providers";

interface RequestBody {
  resumeKey: string;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {;
  const body = (await request.json()) as RequestBody;
  const resumePath = body.resumeKey;

  const s3Client = new S3Provider(env);
  const bucket = env.RESUME_BUCKET;
  const resumeData = await s3Client.getFileArrayBuffer(bucket, resumePath);
  // temporary, allows to quickly view the actual resume
  const presignedUrl = await s3Client.getPresignedUrl(bucket, resumePath);
  console.log(`Presigned URL: ${presignedUrl}`);

  const resumePathParts = resumePath.split('.');
  const fileType = resumePathParts[resumePathParts.length - 1];

  if (fileType !== 'pdf' && fileType !== 'docx') {
    console.error(`Unsupported file type: ${fileType}`);
    return new Response('Unsupported file type', { status: 400 });
  }

  const extractor = new ResumeExtractor(fileType);
  const text = await extractor.extractTextData(resumeData);

  const llmProvider = new LLMProvider(env);
  const prompt = llmProvider.constructPrompt(text);
  const response = await llmProvider.sendPrompt(prompt);
  const output = llmProvider.getResponseText(response);
  
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