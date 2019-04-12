# a6s-minio-s3-docker

Docker image to mirror MinIO bucket to AWS S3

## Usage

### Environment Variables

- `MINIO_HOST` - MinIO host to connect
- `MINIO_ACCESS_KEY_ID` - MinIO access key id
- `MINIO_SECRET_ACCESS_KEY` - MinIO secret access key 
- `MINIO_BUCKET` - MinIO bucket to sync from
- `MINIO_ENCRYPTION_KEY` - MinIO SSE encryption key
- `MINIO_ENCRYPTION_KEY_MD5` - MinIO SSE encryption key MD5 hash

- `S3_REGION` - AWS S3 region where bucket is primary hosted, default value `us-east-1`
- `S3_ACCESS_KEY_ID` - AWS S3 access key id
- `S3_SECRET_ACCESS_KEY` - AWS S3 secret access key 
- `S3_ROLE_ARN` - AWS IAM Role ARN, e.g. `arn:aws:iam::123456789:role` 
- `S3_BUCKET` - AWS S3 bucket to sync files into
- `S3_BUCKET_PREFIX` - AWS S3 bucket prefix to sync files into, should have trailing slash in the end, e.g: `minio/`, defaule value - empty string, means files will be synced into the bucket root
- `S3_ENCRYPTION_KEY` - AWS S3 SSE encryption key
- `S3_ENCRYPTION_KEY_MD5` - AWS S3 SSE encryption key MD5 hash

## Development

Create `config/develop.yml` with:

```yaml
minio: 
  host: ''
  accessKeyId: ''
  secretAccessKey: ''
  bucket: ''
  sse: 
    key: ''
    md5: ''
        
s3: 
  region: ''
  accessKeyId: ''
  secretAccessKey: ''
  bucket: ''
  bucketPrefix: ''
  sse: 
    key: ''
    md5: ''
```

Run:

```bash
yarn build && NODE_ENV=develop yarn start
```