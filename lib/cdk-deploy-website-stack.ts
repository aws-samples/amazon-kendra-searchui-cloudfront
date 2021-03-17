import { App, Stack } from '@aws-cdk/core';
import { CfnCloudFrontOriginAccessIdentity, PriceClass, CloudFrontWebDistribution } from '@aws-cdk/aws-cloudfront';
import { PolicyStatement } from '@aws-cdk/aws-iam';
import { Bucket } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import { OriginAccessIdentity } from '@aws-cdk/aws-cloudfront/lib/origin_access_identity';

export interface CDKWebsiteDeployConfig {
    websiteDistPath: string;
    deploymentVersion: string;
    resourcePrefix: string;
    indexDocument?: string;
}

export class CdkDeployWebsiteStack extends Stack {
  constructor(scope: App, id: string, websiteDeployConfig: CDKWebsiteDeployConfig) {
    super(scope, id);

    const originPath = websiteDeployConfig.deploymentVersion.replace(/\./g, '_');

    const sourceBucket = new Bucket(this, `S3BucketForWebsite`, {
        websiteIndexDocument: 'index.html',
        bucketName: `${websiteDeployConfig.resourcePrefix}-website-${this.account}`
    });

    new BucketDeployment(this, 'DeployWebsite', {
        sources: [Source.asset(websiteDeployConfig.websiteDistPath)],
        destinationBucket: sourceBucket,
        destinationKeyPrefix: originPath
    });

    const cloudFrontOia = new CfnCloudFrontOriginAccessIdentity(this, 'OIA', {
        cloudFrontOriginAccessIdentityConfig: {
            comment: `OIA for ${websiteDeployConfig.resourcePrefix} website.`
        }
    });

    const cloudFrontDistProps = {
            priceClass: PriceClass.PRICE_CLASS_ALL,
            originConfigs: [
                {
                    s3OriginSource: {
                        s3BucketSource: sourceBucket,
                        originAccessIdentity: OriginAccessIdentity.fromOriginAccessIdentityName(
                            this,
                            'OriginAccessIdentity',
                            cloudFrontOia.ref
                        )
                    },
                    behaviors: [{ isDefaultBehavior: true }],
                    originPath: `/${originPath}`
                }
            ]
        };

    new CloudFrontWebDistribution(this, `${websiteDeployConfig.resourcePrefix}-cloudfront`, cloudFrontDistProps);

    const policyStatement = new PolicyStatement();
    policyStatement.addActions('s3:GetBucket*');
    policyStatement.addActions('s3:GetObject*');
    policyStatement.addActions('s3:List*');
    policyStatement.addResources(sourceBucket.bucketArn);
    policyStatement.addResources(`${sourceBucket.bucketArn}/*`);
    policyStatement.addCanonicalUserPrincipal(cloudFrontOia.attrS3CanonicalUserId);

    sourceBucket.addToResourcePolicy(policyStatement);
  }
}
