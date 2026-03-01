import { Duration, RemovalPolicy, Stack, StackProps, Tags, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as path from "node:path";

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

    // GSI4 — calendar by month bucket (workspace + YYYY-MM)
    appTable.addGlobalSecondaryIndex({
      indexName: "GSI4",
      partitionKey: { name: "GSI4PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI4SK", type: dynamodb.AttributeType.STRING },
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

    const api = new apigateway.RestApi(this, "Api", {
      restApiName: `cadence-${props.stage}`,
      deployOptions: {
        stageName: props.stage,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["content-type", "authorization"],
      },
    });

    const apiHandlerDefaults = {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler",
      bundling: {
        minify: true,
        sourceMap: true,
        target: "node22",
      },
      environment: {
        COGNITO_USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        APP_TABLE_NAME: appTable.tableName,
        MEDIA_BUCKET_NAME: mediaBucket.bucketName,
      },
    } as const;

    const loginFn = new NodejsFunction(this, "AuthLoginFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/login.ts"),
      ...apiHandlerDefaults,
    });

    const refreshFn = new NodejsFunction(this, "AuthRefreshFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/refresh.ts"),
      ...apiHandlerDefaults,
    });

    const meFn = new NodejsFunction(this, "AuthMeFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/me.ts"),
      ...apiHandlerDefaults,
    });

    const newPasswordFn = new NodejsFunction(this, "AuthNewPasswordFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/new-password.ts"),
      ...apiHandlerDefaults,
    });

    const logoutFn = new NodejsFunction(this, "AuthLogoutFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/logout.ts"),
      ...apiHandlerDefaults,
    });

    const changePasswordFn = new NodejsFunction(this, "AuthChangePasswordFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/change-password.ts"),
      ...apiHandlerDefaults,
    });

    const updateMeFn = new NodejsFunction(this, "UpdateMeFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/users/update-me.ts"),
      ...apiHandlerDefaults,
    });

    const listWorkspacesFn = new NodejsFunction(this, "ListWorkspacesFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/workspaces/list.ts"),
      ...apiHandlerDefaults,
    });

    const setActiveWorkspaceFn = new NodejsFunction(this, "SetActiveWorkspaceFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/workspaces/set-active.ts"),
      ...apiHandlerDefaults,
    });

    const presignMediaFn = new NodejsFunction(this, "PresignMediaFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/presign.ts"),
      ...apiHandlerDefaults,
    });

    const presignMediaBatchFn = new NodejsFunction(this, "PresignMediaBatchFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/presign-batch.ts"),
      ...apiHandlerDefaults,
    });

    const createMediaFn = new NodejsFunction(this, "CreateMediaFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/create.ts"),
      ...apiHandlerDefaults,
    });

    const createMediaBatchFn = new NodejsFunction(this, "CreateMediaBatchFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/create-batch.ts"),
      ...apiHandlerDefaults,
    });

    const listMediaFn = new NodejsFunction(this, "ListMediaFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/list.ts"),
      ...apiHandlerDefaults,
    });

    const deleteMediaFn = new NodejsFunction(this, "DeleteMediaFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/delete.ts"),
      ...apiHandlerDefaults,
    });

    const deleteMediaBatchFn = new NodejsFunction(this, "DeleteMediaBatchFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/delete-batch.ts"),
      ...apiHandlerDefaults,
    });

    const updateMediaFn = new NodejsFunction(this, "UpdateMediaFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/update.ts"),
      ...apiHandlerDefaults,
    });

    const createPostFn = new NodejsFunction(this, "CreatePostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/create.ts"),
      ...apiHandlerDefaults,
    });

    const listPostsFn = new NodejsFunction(this, "ListPostsFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/list.ts"),
      ...apiHandlerDefaults,
    });

    const getPostFn = new NodejsFunction(this, "GetPostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/get.ts"),
      ...apiHandlerDefaults,
    });

    const updatePostFn = new NodejsFunction(this, "UpdatePostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/update.ts"),
      ...apiHandlerDefaults,
    });

    const submitPostFn = new NodejsFunction(this, "SubmitPostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/submit.ts"),
      ...apiHandlerDefaults,
    });

    const approvePostFn = new NodejsFunction(this, "ApprovePostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/approve.ts"),
      ...apiHandlerDefaults,
    });

    const schedulePostFn = new NodejsFunction(this, "SchedulePostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/schedule.ts"),
      ...apiHandlerDefaults,
    });

    const cancelPostFn = new NodejsFunction(this, "CancelPostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/cancel.ts"),
      ...apiHandlerDefaults,
    });

    const retryPostFn = new NodejsFunction(this, "RetryPostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/retry.ts"),
      ...apiHandlerDefaults,
    });

    const deletePostFn = new NodejsFunction(this, "DeletePostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/delete.ts"),
      ...apiHandlerDefaults,
    });

    const duplicatePostFn = new NodejsFunction(this, "DuplicatePostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/duplicate.ts"),
      ...apiHandlerDefaults,
    });

    const revertToDraftPostFn = new NodejsFunction(this, "RevertToDraftPostFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/revert-to-draft.ts"),
      ...apiHandlerDefaults,
    });

    const resolvePostCodeFn = new NodejsFunction(this, "ResolvePostCodeFn", {
      entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/resolve-code.ts"),
      ...apiHandlerDefaults,
    });

    for (const fn of [
      loginFn,
      refreshFn,
      meFn,
      newPasswordFn,
      updateMeFn,
      listWorkspacesFn,
      setActiveWorkspaceFn,
      presignMediaFn,
      presignMediaBatchFn,
      createMediaFn,
      createMediaBatchFn,
      listMediaFn,
      deleteMediaFn,
      deleteMediaBatchFn,
      updateMediaFn,
      createPostFn,
      listPostsFn,
      getPostFn,
      updatePostFn,
      submitPostFn,
      approvePostFn,
      schedulePostFn,
      cancelPostFn,
      retryPostFn,
      deletePostFn,
      duplicatePostFn,
      revertToDraftPostFn,
      resolvePostCodeFn,
    ]) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["cognito-idp:InitiateAuth", "cognito-idp:RespondToAuthChallenge", "cognito-idp:GetUser"],
          resources: ["*"],
        }),
      );
    }

    appTable.grantReadData(meFn);
    appTable.grantReadWriteData(updateMeFn);
    appTable.grantReadWriteData(listWorkspacesFn);
    appTable.grantReadWriteData(setActiveWorkspaceFn);
    appTable.grantReadWriteData(presignMediaFn);
    appTable.grantReadWriteData(presignMediaBatchFn);
    appTable.grantReadWriteData(createMediaFn);
    appTable.grantReadWriteData(createMediaBatchFn);
    appTable.grantReadWriteData(listMediaFn);
    appTable.grantReadWriteData(deleteMediaFn);
    appTable.grantReadWriteData(deleteMediaBatchFn);
    appTable.grantReadWriteData(updateMediaFn);
    appTable.grantReadWriteData(createPostFn);
    appTable.grantReadWriteData(listPostsFn);
    appTable.grantReadWriteData(getPostFn);
    appTable.grantReadWriteData(updatePostFn);
    appTable.grantReadWriteData(submitPostFn);
    appTable.grantReadWriteData(approvePostFn);
    appTable.grantReadWriteData(schedulePostFn);
    appTable.grantReadWriteData(cancelPostFn);
    appTable.grantReadWriteData(retryPostFn);
    appTable.grantReadWriteData(deletePostFn);
    appTable.grantReadWriteData(duplicatePostFn);
    appTable.grantReadWriteData(revertToDraftPostFn);
    appTable.grantReadWriteData(resolvePostCodeFn);

    mediaBucket.grantPut(presignMediaFn);
    mediaBucket.grantPut(presignMediaBatchFn);
    mediaBucket.grantRead(listMediaFn);
    mediaBucket.grantDelete(deleteMediaFn);
    mediaBucket.grantDelete(deleteMediaBatchFn);

    logoutFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["cognito-idp:GlobalSignOut"],
        resources: ["*"],
      }),
    );

    changePasswordFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["cognito-idp:ChangePassword"],
        resources: ["*"],
      }),
    );

    const auth = api.root.addResource("auth");
    auth.addResource("login").addMethod("POST", new apigateway.LambdaIntegration(loginFn));
    auth.addResource("refresh").addMethod("POST", new apigateway.LambdaIntegration(refreshFn));
    auth.addResource("new-password").addMethod("POST", new apigateway.LambdaIntegration(newPasswordFn));
    auth.addResource("me").addMethod("GET", new apigateway.LambdaIntegration(meFn));
    auth.addResource("logout").addMethod("POST", new apigateway.LambdaIntegration(logoutFn));
    auth.addResource("change-password").addMethod("POST", new apigateway.LambdaIntegration(changePasswordFn));

    const users = api.root.addResource("users");
    users.addResource("me").addMethod("PATCH", new apigateway.LambdaIntegration(updateMeFn));

    const workspaces = api.root.addResource("workspaces");
    workspaces.addMethod("GET", new apigateway.LambdaIntegration(listWorkspacesFn));
    workspaces.addResource("active").addMethod("POST", new apigateway.LambdaIntegration(setActiveWorkspaceFn));

    const media = api.root.addResource("media");
    const mediaPresign = media.addResource("presign");
    mediaPresign.addMethod("POST", new apigateway.LambdaIntegration(presignMediaFn));
    mediaPresign.addResource("batch").addMethod("POST", new apigateway.LambdaIntegration(presignMediaBatchFn));
    media.addMethod("POST", new apigateway.LambdaIntegration(createMediaFn));
    const mediaBatch = media.addResource("batch");
    mediaBatch.addMethod("POST", new apigateway.LambdaIntegration(createMediaBatchFn));
    mediaBatch.addResource("delete").addMethod("POST", new apigateway.LambdaIntegration(deleteMediaBatchFn));
    media.addMethod("GET", new apigateway.LambdaIntegration(listMediaFn));
    const mediaById = media.addResource("{id}");
    mediaById.addMethod("DELETE", new apigateway.LambdaIntegration(deleteMediaFn));
    mediaById.addMethod("PATCH", new apigateway.LambdaIntegration(updateMediaFn));

    const posts = api.root.addResource("posts");
    posts.addMethod("POST", new apigateway.LambdaIntegration(createPostFn));
    posts.addMethod("GET", new apigateway.LambdaIntegration(listPostsFn));
    posts.addResource("resolve").addMethod("GET", new apigateway.LambdaIntegration(resolvePostCodeFn));
    const postById = posts.addResource("{id}");
    postById.addMethod("GET", new apigateway.LambdaIntegration(getPostFn));
    postById.addMethod("PUT", new apigateway.LambdaIntegration(updatePostFn));
    postById.addMethod("DELETE", new apigateway.LambdaIntegration(deletePostFn));
    postById.addResource("duplicate").addMethod("POST", new apigateway.LambdaIntegration(duplicatePostFn));
    postById.addResource("submit").addMethod("POST", new apigateway.LambdaIntegration(submitPostFn));
    postById.addResource("approve").addMethod("POST", new apigateway.LambdaIntegration(approvePostFn));
    postById.addResource("schedule").addMethod("POST", new apigateway.LambdaIntegration(schedulePostFn));
    postById.addResource("cancel").addMethod("POST", new apigateway.LambdaIntegration(cancelPostFn));
    postById.addResource("retry").addMethod("POST", new apigateway.LambdaIntegration(retryPostFn));
    postById.addResource("revert-to-draft").addMethod("POST", new apigateway.LambdaIntegration(revertToDraftPostFn));

    new CfnOutput(this, "Stage", { value: props.stage });
    new CfnOutput(this, "Region", { value: Stack.of(this).region });
    new CfnOutput(this, "AppTableName", { value: appTable.tableName });
    new CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
    new CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "CognitoUserPoolClientId", { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, "ApiBaseUrl", { value: api.url });
  }
}
