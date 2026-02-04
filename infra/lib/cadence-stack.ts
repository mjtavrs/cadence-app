import { Duration, RemovalPolicy, Stack, StackProps, Tags, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";

type Stage = "dev" | "prod";

export interface CadenceStackProps extends StackProps {
  stage: Stage;
}

export class CadenceStack extends Stack {
  constructor(scope: Construct, id: string, props: CadenceStackProps) {
    super(scope, id, props);

    Tags.of(this).add("project", "cadence");
    Tags.of(this).add("stage", props.stage);

    const removalPolicy = props.stage === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    const appTable = new dynamodb.Table(this, "AppTable", {
      tableName: `cadence-${props.stage}-app`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });

    // GSI1 — user by email (login rápido)
    appTable.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2 — calendar by week bucket
    appTable.addGlobalSecondaryIndex({
      indexName: "GSI2",
      partitionKey: { name: "GSI2PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI2SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI3 — dispatch queue (due posts <= now)
    appTable.addGlobalSecondaryIndex({
      indexName: "GSI3",
      partitionKey: { name: "GSI3PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI3SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const mediaBucket = new s3.Bucket(this, "MediaBucket", {
      bucketName: `cadence-${props.stage}-media-${Stack.of(this).account}-${Stack.of(this).region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: props.stage === "dev",
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.HEAD],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: Duration.hours(1).toSeconds(),
        },
      ],
    });

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `cadence-${props.stage}`,
      signInAliases: { email: true },
      selfSignUpEnabled: false,
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(7),
      },
      removalPolicy,
    });

    const userPoolClient = userPool.addClient("WebClient", {
      userPoolClientName: `cadence-${props.stage}-web`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      refreshTokenValidity: Duration.days(30),
    });

    new CfnOutput(this, "Stage", { value: props.stage });
    new CfnOutput(this, "Region", { value: Stack.of(this).region });
    new CfnOutput(this, "AppTableName", { value: appTable.tableName });
    new CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
    new CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "CognitoUserPoolClientId", { value: userPoolClient.userPoolClientId });
  }
}
