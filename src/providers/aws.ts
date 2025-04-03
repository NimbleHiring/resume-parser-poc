import { GetObjectCommand, GetObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class S3Provider {
  private client: S3Client;

  constructor(env: Env) {
    this.client = new S3Client({ region: 'us-west-1', credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    }});
  }

  async getPresignedUrl(bucket: string, key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: 7200, // 2 hours
    });

    return url;
  }

  async getObject(bucket: string, key: string): Promise<GetObjectCommandOutput> {
    return this.client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
  }

  async getFileArrayBuffer(bucket: string, key: string): Promise<ArrayBuffer> {
    const start = performance.now();
    const response = await this.getObject(bucket, key);

    if (!response.Body) {
      throw new Error('No response body');
    }

    const byteArray = await response.Body.transformToByteArray();
    const end = performance.now();
    const s3Time = end - start;
    console.log(`S3 retrieval time: ${s3Time.toFixed(2)}ms`);

    return byteArray.buffer;
  }
}