import { GetObjectCommand, GetObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";

export class S3Provider {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({ region: 'us-east-1'});
  }

  async getObject(bucket: string, key: string): Promise<GetObjectCommandOutput> {
    return this.client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
  }

  async getFileArrayBuffer(bucket: string, key: string): Promise<any> {
    const response = await this.getObject(bucket, key);

    if (!response.Body) {
      throw new Error('No response body');
    }

    const byteArray = await response.Body.transformToByteArray();
    return byteArray.buffer;
  }
}