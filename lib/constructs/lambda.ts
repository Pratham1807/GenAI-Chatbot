import { BrazilPackage, BrazilPackageLambdaCode, LambdaAsset } from '@amzn/pipelines';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { IManagedPolicy, ManagedPolicy, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { StageName } from '../enum/stageName';
import Utils from '../utils/utils';
import { CreateIAMRole } from './iamRole';
import lambda = require('aws-cdk-lib/aws-lambda');
import { LambdaConfig } from '../config/lambdaConfig';

export interface AutoScalingConfig {
  readonly minAutoScalingCapacity?: number;
  readonly maxAutoScalingCapacity: number;
  readonly utilizationTarget: number;
  readonly provisionedConcurrentExecutions?: number;
}

export interface LambdaConstructProps {
  readonly stage: string;
  readonly name: string;
  readonly handler: string;
  readonly managedPolicies?: IManagedPolicy[];
  readonly statements?: PolicyStatement[];
  readonly timeout?: Duration;
  readonly reservedConcurrentExecutions?: number;
  readonly autoScalingConfig?: AutoScalingConfig;
}

export class LambdaConstruct extends Construct {
  public readonly function: lambda.Function;
  private readonly executionRole: Role;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    const functionName = `${props.name}-Function`;

    new LogGroup(scope, `${props.name}-FunctionLogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.TEN_YEARS,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.executionRole = CreateIAMRole(scope, {
      roleId: `${functionName}ExecutionRole`,
      roleName: `${functionName}ExecutionRole`,
      description: `Execution role for ${functionName}`,
      servicePrincipal: 'lambda.amazonaws.com',
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    props.managedPolicies?.forEach((managedPolicy) => this.executionRole.addManagedPolicy(managedPolicy));
    props.statements?.forEach((statement) => this.executionRole.addToPolicy(statement));

    this.function = new lambda.Function(scope, `${functionName}`, {
      architecture: Architecture.X86_64,
      functionName: functionName,
      description: `Lambda function for ${props.name}. Revision: ${new Date().getTime()}`,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-handler')),
      handler: props.handler,
      memorySize: 3008,
      runtime: Runtime.JAVA_17,
      timeout: props.timeout || Duration.minutes(5),
      reservedConcurrentExecutions: props.reservedConcurrentExecutions,
      role: this.executionRole,
      environment: {
        stage: props.stage,
      },
      retryAttempts: 2,
    });

    this.function.addEnvironment('Stage', props.stage);
  }
}

