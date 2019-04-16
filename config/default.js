module.exports = {
    minio: {
        host: process.env.MINIO_HOST,
        accessKeyId: process.env.MINIO_ACCESS_KEY_ID,
        secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY,
        bucket: process.env.MINIO_BUCKET,
        sse: {
            key: process.env.MINIO_ENCRYPTION_KEY,
            md5: process.env.MINIO_ENCRYPTION_KEY_MD5,
        }        
    },
    s3: {
        region: process.env.S3_REGION || 'us-east-1',
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        roleName: process.env.S3_ROLE_NAME,
        roleArn: process.env.S3_ROLE_ARN,
        bucket: process.env.S3_BUCKET,
        bucketPrefix: process.env.S3_BUCKET_PREFIX || '',
        sse: {
            key: process.env.S3_ENCRYPTION_KEY,
            md5: process.env.S3_ENCRYPTION_KEY_MD5,
        }  
    }
}
