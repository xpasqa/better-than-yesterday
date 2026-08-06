// Ambient type shim for @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner
// Replaced when npm install runs in deployment.
// docs/feature/2.backend/4.storage/spec.md §5

declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(opts: {
      endpoint?: string
      region?: string
      credentials?: { accessKeyId: string; secretAccessKey: string }
      forcePathStyle?: boolean
    })
    send(command: unknown): Promise<unknown>
  }

  export class PutObjectCommand {
    constructor(opts: {
      Bucket: string
      Key: string
      ContentType?: string
      ContentLength?: number
    })
  }

  export class GetObjectCommand {
    constructor(opts: { Bucket: string; Key: string })
  }

  export class HeadObjectCommand {
    constructor(opts: { Bucket: string; Key: string })
  }

  export class DeleteObjectCommand {
    constructor(opts: { Bucket: string; Key: string })
  }

  export class DeleteObjectsCommand {
    constructor(opts: {
      Bucket: string
      Delete: { Objects: Array<{ Key: string }> }
    })
  }

  export interface HeadObjectCommandOutput {
    ContentLength?: number
    ContentType?: string
  }
}

declare module '@aws-sdk/s3-request-presigner' {
  import type { S3Client } from '@aws-sdk/client-s3'
  export function getSignedUrl(
    client: S3Client,
    command: unknown,
    options: { expiresIn: number },
  ): Promise<string>
}
