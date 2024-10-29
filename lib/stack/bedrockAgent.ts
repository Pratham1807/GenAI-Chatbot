import { DeploymentEnvironment, DeploymentStack, SoftwareType } from '@amzn/pipelines';
import { Construct } from 'constructs';
import { S3Construct } from '../constructs/s3';
import { readFileSync } from 'fs';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Source } from 'aws-cdk-lib/aws-s3-deployment';
import { CfnAgent, CfnAgentAlias } from 'aws-cdk-lib/aws-bedrock';
import { BedrockAgentConstruct } from '../constructs/bedrock';
import { BedrockFoundationModel } from '../enum/BedrockFoundationModel';
import { LambdaConstruct } from '../constructs/lambda';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import lambda = require('aws-cdk-lib/aws-lambda');
import Utils from '../utils/utils';
import { StageName } from '../enum/stageName';
import { DynamoDBConstruct } from '../constructs/dynamoDB';
import { TableConstants } from '../constants/tableConstants';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';

export interface LeaveStoneAgentStackProps {
  readonly env: DeploymentEnvironment;
  readonly stackName?: string;
  readonly stage: string;
}

export class LeaveStoneAgentStack extends DeploymentStack {
  private agentName = 'ChatbotAgent';

  constructor(scope: Construct, id: string, props: LeaveStoneAgentStackProps) {
    super(scope, id, {
      softwareType: SoftwareType.INFRASTRUCTURE,
      ...props,
    });
    
    const timestamp = new Date().toISOString().substring(0, 19).replace(/T|:/g, '-');

    const agent = new BedrockAgentConstruct(this, 'ChatbotAgent', {
      agentName: `${this.agentName}`,
      description: 'Bedrock agent to answer user questions',
      partition: this.partition,
      region: this.region,
      foundationModel: BedrockFoundationModel.ANTHROPIC_CLAUDE_3_SONNET,
      instruction: "",
      enableUserInput: true
    });

    const agentAlias = new CfnAgentAlias(this, 'ChatbotAgentAlias', {
      agentId: agent.agent.attrAgentId,
      agentAliasName: 'LATEST',
      description: `Published at ${timestamp}`,
    });
    this.agentAlias = leaveStoneAgentAlias;

    leaveStoneAgentAlias.node.addDependency(leaveStoneAgent);
  }
}
