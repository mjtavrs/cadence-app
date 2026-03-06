"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CadenceStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const path = __importStar(require("node:path"));
class CadenceStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        aws_cdk_lib_1.Tags.of(this).add("project", "cadence");
        aws_cdk_lib_1.Tags.of(this).add("stage", props.stage);
        const removalPolicy = props.stage === "prod" ? aws_cdk_lib_1.RemovalPolicy.RETAIN : aws_cdk_lib_1.RemovalPolicy.DESTROY;
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
            bucketName: `cadence-${props.stage}-media-${aws_cdk_lib_1.Stack.of(this).account}-${aws_cdk_lib_1.Stack.of(this).region}`,
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
                    maxAge: aws_cdk_lib_1.Duration.hours(1).toSeconds(),
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
                tempPasswordValidity: aws_cdk_lib_1.Duration.days(7),
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
            refreshTokenValidity: aws_cdk_lib_1.Duration.days(30),
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
        };
        const loginFn = new aws_lambda_nodejs_1.NodejsFunction(this, "AuthLoginFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/login.ts"),
            ...apiHandlerDefaults,
        });
        const refreshFn = new aws_lambda_nodejs_1.NodejsFunction(this, "AuthRefreshFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/refresh.ts"),
            ...apiHandlerDefaults,
        });
        const meFn = new aws_lambda_nodejs_1.NodejsFunction(this, "AuthMeFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/me.ts"),
            ...apiHandlerDefaults,
        });
        const newPasswordFn = new aws_lambda_nodejs_1.NodejsFunction(this, "AuthNewPasswordFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/new-password.ts"),
            ...apiHandlerDefaults,
        });
        const logoutFn = new aws_lambda_nodejs_1.NodejsFunction(this, "AuthLogoutFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/logout.ts"),
            ...apiHandlerDefaults,
        });
        const changePasswordFn = new aws_lambda_nodejs_1.NodejsFunction(this, "AuthChangePasswordFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/auth/change-password.ts"),
            ...apiHandlerDefaults,
        });
        const updateMeFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UpdateMeFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/users/update-me.ts"),
            ...apiHandlerDefaults,
        });
        const listWorkspacesFn = new aws_lambda_nodejs_1.NodejsFunction(this, "ListWorkspacesFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/workspaces/list.ts"),
            ...apiHandlerDefaults,
        });
        const setActiveWorkspaceFn = new aws_lambda_nodejs_1.NodejsFunction(this, "SetActiveWorkspaceFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/workspaces/set-active.ts"),
            ...apiHandlerDefaults,
        });
        const presignMediaFn = new aws_lambda_nodejs_1.NodejsFunction(this, "PresignMediaFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/presign.ts"),
            ...apiHandlerDefaults,
        });
        const presignMediaBatchFn = new aws_lambda_nodejs_1.NodejsFunction(this, "PresignMediaBatchFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/presign-batch.ts"),
            ...apiHandlerDefaults,
        });
        const createMediaFn = new aws_lambda_nodejs_1.NodejsFunction(this, "CreateMediaFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/create.ts"),
            ...apiHandlerDefaults,
        });
        const createMediaBatchFn = new aws_lambda_nodejs_1.NodejsFunction(this, "CreateMediaBatchFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/create-batch.ts"),
            ...apiHandlerDefaults,
        });
        const listMediaFn = new aws_lambda_nodejs_1.NodejsFunction(this, "ListMediaFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/list.ts"),
            ...apiHandlerDefaults,
        });
        const mediaSummaryFn = new aws_lambda_nodejs_1.NodejsFunction(this, "MediaSummaryFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/summary.ts"),
            ...apiHandlerDefaults,
        });
        const listMediaFoldersFn = new aws_lambda_nodejs_1.NodejsFunction(this, "ListMediaFoldersFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/folders-list.ts"),
            ...apiHandlerDefaults,
        });
        const createMediaFolderFn = new aws_lambda_nodejs_1.NodejsFunction(this, "CreateMediaFolderFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/folders-create.ts"),
            ...apiHandlerDefaults,
        });
        const resolveMediaFoldersTreeFn = new aws_lambda_nodejs_1.NodejsFunction(this, "ResolveMediaFoldersTreeFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/folders-resolve-tree.ts"),
            ...apiHandlerDefaults,
        });
        const renameMediaFolderFn = new aws_lambda_nodejs_1.NodejsFunction(this, "RenameMediaFolderFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/folders-rename.ts"),
            ...apiHandlerDefaults,
        });
        const deleteMediaFolderFn = new aws_lambda_nodejs_1.NodejsFunction(this, "DeleteMediaFolderFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/folders-delete.ts"),
            ...apiHandlerDefaults,
        });
        const deleteMediaFn = new aws_lambda_nodejs_1.NodejsFunction(this, "DeleteMediaFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/delete.ts"),
            ...apiHandlerDefaults,
        });
        const deleteMediaBatchFn = new aws_lambda_nodejs_1.NodejsFunction(this, "DeleteMediaBatchFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/delete-batch.ts"),
            ...apiHandlerDefaults,
        });
        const moveMediaBatchFn = new aws_lambda_nodejs_1.NodejsFunction(this, "MoveMediaBatchFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/move-batch.ts"),
            ...apiHandlerDefaults,
        });
        const updateMediaFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UpdateMediaFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/media/update.ts"),
            ...apiHandlerDefaults,
        });
        const createPostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "CreatePostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/create.ts"),
            ...apiHandlerDefaults,
        });
        const listPostsFn = new aws_lambda_nodejs_1.NodejsFunction(this, "ListPostsFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/list.ts"),
            ...apiHandlerDefaults,
        });
        const getPostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "GetPostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/get.ts"),
            ...apiHandlerDefaults,
        });
        const updatePostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UpdatePostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/update.ts"),
            ...apiHandlerDefaults,
        });
        const submitPostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "SubmitPostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/submit.ts"),
            ...apiHandlerDefaults,
        });
        const approvePostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "ApprovePostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/approve.ts"),
            ...apiHandlerDefaults,
        });
        const schedulePostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "SchedulePostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/schedule.ts"),
            ...apiHandlerDefaults,
        });
        const cancelPostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "CancelPostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/cancel.ts"),
            ...apiHandlerDefaults,
        });
        const retryPostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "RetryPostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/retry.ts"),
            ...apiHandlerDefaults,
        });
        const deletePostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "DeletePostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/delete.ts"),
            ...apiHandlerDefaults,
        });
        const duplicatePostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "DuplicatePostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/duplicate.ts"),
            ...apiHandlerDefaults,
        });
        const revertToDraftPostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "RevertToDraftPostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/revert-to-draft.ts"),
            ...apiHandlerDefaults,
        });
        const flagPostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "FlagPostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/flag.ts"),
            ...apiHandlerDefaults,
        });
        const unflagPostFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UnflagPostFn", {
            entry: path.resolve(__dirname, "../../apps/api/src/handlers/posts/unflag.ts"),
            ...apiHandlerDefaults,
        });
        const resolvePostCodeFn = new aws_lambda_nodejs_1.NodejsFunction(this, "ResolvePostCodeFn", {
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
            mediaSummaryFn,
            listMediaFoldersFn,
            createMediaFolderFn,
            resolveMediaFoldersTreeFn,
            renameMediaFolderFn,
            deleteMediaFolderFn,
            deleteMediaFn,
            deleteMediaBatchFn,
            moveMediaBatchFn,
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
            flagPostFn,
            unflagPostFn,
            resolvePostCodeFn,
        ]) {
            fn.addToRolePolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["cognito-idp:InitiateAuth", "cognito-idp:RespondToAuthChallenge", "cognito-idp:GetUser"],
                resources: ["*"],
            }));
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
        appTable.grantReadWriteData(mediaSummaryFn);
        appTable.grantReadWriteData(listMediaFoldersFn);
        appTable.grantReadWriteData(createMediaFolderFn);
        appTable.grantReadWriteData(resolveMediaFoldersTreeFn);
        appTable.grantReadWriteData(renameMediaFolderFn);
        appTable.grantReadWriteData(deleteMediaFolderFn);
        appTable.grantReadWriteData(deleteMediaFn);
        appTable.grantReadWriteData(deleteMediaBatchFn);
        appTable.grantReadWriteData(moveMediaBatchFn);
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
        appTable.grantReadWriteData(flagPostFn);
        appTable.grantReadWriteData(unflagPostFn);
        appTable.grantReadWriteData(resolvePostCodeFn);
        mediaBucket.grantPut(presignMediaFn);
        mediaBucket.grantPut(presignMediaBatchFn);
        mediaBucket.grantRead(listMediaFn);
        mediaBucket.grantDelete(deleteMediaFn);
        mediaBucket.grantDelete(deleteMediaBatchFn);
        logoutFn.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["cognito-idp:GlobalSignOut"],
            resources: ["*"],
        }));
        changePasswordFn.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["cognito-idp:ChangePassword"],
            resources: ["*"],
        }));
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
        media.addResource("summary").addMethod("GET", new apigateway.LambdaIntegration(mediaSummaryFn));
        const mediaBatch = media.addResource("batch");
        mediaBatch.addMethod("POST", new apigateway.LambdaIntegration(createMediaBatchFn));
        mediaBatch.addResource("delete").addMethod("POST", new apigateway.LambdaIntegration(deleteMediaBatchFn));
        mediaBatch.addResource("move").addMethod("POST", new apigateway.LambdaIntegration(moveMediaBatchFn));
        media.addMethod("GET", new apigateway.LambdaIntegration(listMediaFn));
        const mediaFolders = media.addResource("folders");
        mediaFolders.addMethod("GET", new apigateway.LambdaIntegration(listMediaFoldersFn));
        mediaFolders.addMethod("POST", new apigateway.LambdaIntegration(createMediaFolderFn));
        mediaFolders.addResource("resolve-tree").addMethod("POST", new apigateway.LambdaIntegration(resolveMediaFoldersTreeFn));
        const mediaFolderById = mediaFolders.addResource("{id}");
        mediaFolderById.addMethod("PATCH", new apigateway.LambdaIntegration(renameMediaFolderFn));
        mediaFolderById.addMethod("DELETE", new apigateway.LambdaIntegration(deleteMediaFolderFn));
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
        postById.addResource("flag").addMethod("POST", new apigateway.LambdaIntegration(flagPostFn));
        postById.addResource("unflag").addMethod("POST", new apigateway.LambdaIntegration(unflagPostFn));
        new aws_cdk_lib_1.CfnOutput(this, "Stage", { value: props.stage });
        new aws_cdk_lib_1.CfnOutput(this, "Region", { value: aws_cdk_lib_1.Stack.of(this).region });
        new aws_cdk_lib_1.CfnOutput(this, "AppTableName", { value: appTable.tableName });
        new aws_cdk_lib_1.CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
        new aws_cdk_lib_1.CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId });
        new aws_cdk_lib_1.CfnOutput(this, "CognitoUserPoolClientId", { value: userPoolClient.userPoolClientId });
        new aws_cdk_lib_1.CfnOutput(this, "ApiBaseUrl", { value: api.url });
    }
}
exports.CadenceStack = CadenceStack;
