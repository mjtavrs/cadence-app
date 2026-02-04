#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CadenceStack } from "../lib/cadence-stack";

type Stage = "dev" | "prod";

function getStage(app: cdk.App): Stage {
  const stage = app.node.tryGetContext("stage");
  if (stage === "dev" || stage === "prod") return stage;
  throw new Error('Missing/invalid stage. Use "-c stage=dev" or "-c stage=prod".');
}

const app = new cdk.App();
const stage = getStage(app);

new CadenceStack(app, `cadence-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
});
