import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';
import { AnyPrincipal, Effect, PolicyStatement, ArnPrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { BucketDeployment, ISource } from 'aws-cdk-lib/aws-s3-deployment';
import { IFunction } from 'aws-cdk-lib/aws-lambda';

export interface S3ConstructProps {
  readonly stage: string;
  readonly account: string;
  readonly bucketName: string;
  readonly bucketEncryption?: BucketEncryption;
  readonly bucketEncryptionKey?: Key;
  readonly removalPolicy?: RemovalPolicy;
  readonly lambdaFunctions?: IFunction[];
}

export class S3Construct extends Construct {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props: S3ConstructProps) {
    super(scope, id);

    const bucketSuffix = `${props.stage}-${props.account}`;
    const bucketEncryption = props.bucketEncryption || BucketEncryption.KMS_MANAGED;
    const bucketEncryptionKey = props.bucketEncryptionKey || undefined;
    const bucketName = `${props.bucketName}-${bucketSuffix}`.toLowerCase();
    const bucketRemovalPolicy = props.removalPolicy || RemovalPolicy.RETAIN;

    this.bucket = new Bucket(scope, bucketName, {
      bucketName: `${bucketName}`,
      encryption: bucketEncryption,
      encryptionKey: bucketEncryptionKey,
      enforceSSL: true,
      removalPolicy: bucketRemovalPolicy,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });
    this.addDenyInsecureHttpAccessPolicy(this.bucket);

    props.lambdaFunctions?.forEach((lambdaFunction) => {
      this.bucket.grantReadWrite(lambdaFunction);
    });
  }

  public addBucketPolicy(
    principals: ArnPrincipal[],
    actions: string[],
    resources: string[],
    bucketPolicySid?: string,
    keyPolicySid?: string,
  ) {
    this.bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: bucketPolicySid,
        principals: principals,
        actions: actions,
        effect: Effect.ALLOW,
        resources: resources,
      }),
    );

    if (this.bucket?.encryptionKey) {
      this.bucket.encryptionKey.addToResourcePolicy(
        new PolicyStatement({
          sid: keyPolicySid,
          principals: principals,
          actions: ['kms:Encrypt', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
          effect: Effect.ALLOW,
          resources: ['*'],
        }),
      );
    }
  }

  private addDenyInsecureHttpAccessPolicy(bucket: Bucket) {
    bucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ['s3:*'],
        resources: [bucket.bucketArn, bucket.arnForObjects('*')],
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false',
          },
        },
      }),
    );
  }

  public performBucketDeployment(scope: Construct, id: string, sources: ISource[], destinationKeyPrefix?: string) {
    return new BucketDeployment(this, id, {
      destinationBucket: this.bucket,
      sources: sources,
      destinationKeyPrefix: destinationKeyPrefix,
    });
  }
}
