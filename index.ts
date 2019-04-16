import * as AWS from 'aws-sdk';
import { get, has } from 'config';
import * as colors from 'colors';

colors.enable();

let skipped = 0;
let updated = 0;
let deleted = 0;
let created = 0;

const minio = new AWS.S3({
  s3ForcePathStyle: true,
  credentials: new AWS.Credentials({
    accessKeyId: get('minio.accessKeyId'),
    secretAccessKey: get('minio.secretAccessKey'),    
  }),
  signatureVersion: 'v4',
  endpoint: get('minio.host'),
  region: '',
  sslEnabled: true,
  logger: {
    log: function() {
      console.log('[MINIO]'.red, ...arguments);
    }
  }
});

const s3Options: AWS.S3.Types.ClientConfiguration = {
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
  region: get('s3.region'),
  logger: {
    log: function() {
      console.log('[S3]'.blue, ...arguments);
    }
  }
}

if (has('s3.accessKeyId') && has('s3.secretAccessKey')) {
  s3Options.credentials = new AWS.Credentials({
    accessKeyId: get('s3.accessKeyId'),
    secretAccessKey: get('s3.secretAccessKey'),
  });  
} else {
  s3Options.credentials = new AWS.EC2MetadataCredentials();
}

const s3 = new AWS.S3(s3Options);

const headMinioObject = async (key: string): Promise<AWS.S3.Types.HeadObjectOutput | undefined> => {
  console.debug('[MINIO]'.red, `call headObject action for key: ${key} in bucket ${get('s3.bucket')}`);
  try {
    return await new Promise<AWS.S3.Types.HeadObjectOutput>((res, rej) => {
      minio.headObject(
        {
          Bucket: get('minio.bucket'),
          Key: key,
          SSECustomerAlgorithm: 'AES256',
          SSECustomerKey: get('minio.sse.key'),
          SSECustomerKeyMD5: get('minio.sse.md5'),
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }

          res(data);
        },
      );
    });
  } catch (e) {
    if (e.statusCode && e.statusCode === 404) {
      return;
    }

    console.error('[MINIO]'.red, `headObject action failed for key: ${key}`);
    throw e;
  }
};

const headS3Object = async (key: string): Promise<AWS.S3.Types.HeadObjectOutput | undefined> => {
  const s3Key = get('s3.bucketPrefix') + key;
  console.debug('[S3]'.blue, `call headObject for key: ${s3Key} in bucket ${get('s3.bucket')}`);
  try {
    return await new Promise<AWS.S3.Types.HeadObjectOutput>((res, rej) => {
      s3.headObject(
        {
          Bucket: get('s3.bucket'),
          Key: s3Key,
          SSECustomerAlgorithm: 'AES256',
          SSECustomerKey: get('s3.sse.key'),
          SSECustomerKeyMD5: get('s3.sse.md5'),          
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }

          res(data);
        },
      );
    });
  } catch (e) {
    if (e.statusCode && e.statusCode === 404) {
      return;
    }   

    console.error('[S3]'.blue, `headObject failed for key: ${s3Key}`);
    throw e;
  }
};

const deleteFromS3 = async (s3Object: AWS.S3.Object): Promise<void> => {
  const key = s3Object.Key || '';
  let minioKey: string = key;
  const prefix: string = get('s3.bucketPrefix');
  minioKey = minioKey.substring(prefix.length);
  const minioObject = await headMinioObject(minioKey);

  if (!minioObject) {
    await new Promise<void>((res, rej) => {
      s3.deleteObject(
        {
          Key: key,
          Bucket: get('s3.bucket'),
        },
        err => {
          if (err) {
            return rej(err);
          }

          console.log(`-> ${'[DELETED]'.red} S3 object for key: ${s3Object.Key}`);
          deleted++;
          res();
        },
      );
    });
  }
};

const copyToS3 = async (minioObject: AWS.S3.Object): Promise<void> => {
  const key = minioObject.Key || '';
  const s3Object = await headS3Object(key);
  const s3ObjectModified = (s3Object && s3Object.LastModified && s3Object.LastModified.getTime()) || 0;
  const minioObjectModified = (minioObject.LastModified && minioObject.LastModified.getTime()) || 0;

  if (!s3Object || (s3ObjectModified < minioObjectModified && s3Object.ContentLength !== minioObject.Size)) {
    await new Promise<void>((res, rej) => {
      const rs = minio
        .getObject({
          Key: key,
          Bucket: get('minio.bucket'),
          SSECustomerAlgorithm: 'AES256',
          SSECustomerKey: get('minio.sse.key'),
          SSECustomerKeyMD5: get('minio.sse.md5'),
        })
        .createReadStream();

      s3.upload(
        {
          Key: get('s3.bucketPrefix') + key,
          Bucket: get('s3.bucket'),
          Body: rs,
          SSECustomerAlgorithm: 'AES256',
          SSECustomerKey: get('s3.sse.key'),
          SSECustomerKeyMD5: get('s3.sse.md5'),
        },
        err => {
          if (err) {
            console.log('[S3]'.red, `upload failed for key: ${get('s3.bucketPrefix') + key}`);

            return rej(err);
          }

          if (!s3Object) {
            created++;
            console.log(`-> ${'[CREATED]'.green} new S3 object for key: ${get('s3.bucketPrefix') + key}`);
          } else {
            updated++;
            console.log(`-> ${'[UPDATED]'.blue} S3 object for key: ${get('s3.bucketPrefix') + key}`);
          }
          res();
        },
      );
    });
  } else {
    skipped++;
    console.log(`-> ${'[SKIPPED]'.gray} S3 object for key: ${minioObject.Key}`);
  }
};

const listMinioObjects = async (nextMarker?: string) => {
  return await new Promise<AWS.S3.Types.ListObjectsOutput>((res, rej) => {
    minio.listObjects(
      {
        Prefix: '',
        Bucket: get('minio.bucket'),
        Marker: nextMarker,
      },
      (err, data) => {
        if (err) {
          console.error('[MINIO]'.red, 'listObjects failed');

          return rej(err);
        }
        res(data);
      },
    );
  });
};

const listS3Objects = async (continuationToken?: string) => {
  return await new Promise<AWS.S3.Types.ListObjectsV2Output>((res, rej) => {
    s3.listObjectsV2(
      {
        Prefix: get('s3.bucketPrefix'),
        Bucket: get('s3.bucket'),
        ContinuationToken: continuationToken,
      },
      (err, data) => {
        if (err) {
          console.error('[S3]'.blue, `listObjects failed. Bucket: ${get('s3.bucket')} Prefix: ${get('s3.bucketPrefix')}`);

          return rej(err);
        }

        res(data);
      },
    );
  });
};

const processMinioObjects = async (nextMarker?: string): Promise<void> => {
  const page = await listMinioObjects(nextMarker);

  for (const o of page.Contents || []) {
    if (o.Key && !o.Key.endsWith('/')) {
      await copyToS3(o);
    }
  }

  if (page.IsTruncated && page.NextMarker) {
    await processMinioObjects(page.NextMarker);
  }
};

const processS3Objects = async (nextMarker?: string): Promise<void> => {
  const page = await listS3Objects(nextMarker);

  for (const o of page.Contents || []) {
    if (o.Key && !o.Key.endsWith('/')) {
      await deleteFromS3(o);
    }
  }

  if (page.IsTruncated && page.ContinuationToken) {
    await processS3Objects(page.ContinuationToken);
  }
};

const s3UpdateConfig = async (): Promise<void> => {
  if (!has('s3.accessKeyId') && !has('s3.secretAccessKey')) {
    await new Promise<void>((res, rej) => {
      console.log(`AWS: trying to get EC2 instance credentials...`);      
      s3.config.getCredentials((err) => {
        if (err) {
          console.log(`AWS: failed to obtain EC2 instance credentials`);      
          return rej(err);
        }
        
        console.log(`AWS: EC2 instance credentials successfully received. S3.AccessKeyID: ${s3.config.credentials && s3.config.credentials.accessKeyId}`);
        res();
      });      
    });
  }
}

const run = async (): Promise<void> => {
  console.log('-> start processing...');
  await s3UpdateConfig();
  await processMinioObjects();
  await processS3Objects();
  console.log('<- processing complete');
  console.log(`CREATED: ${created.toString().green}`);
  console.log(`UPDATED: ${updated.toString().blue}`);
  console.log(`DELETED: ${deleted.toString().red}`);
  console.log(`SKIPPED: ${skipped.toString().gray}`);
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
