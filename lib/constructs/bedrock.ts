import { Construct } from 'constructs';
import { CfnAgent } from 'aws-cdk-lib/aws-bedrock';
import { Effect, ManagedPolicy, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { CreateIAMRole } from './iamRole';
import { BedrockFoundationModel } from '../enum/BedrockFoundationModel';

export interface OverrideConfiguration {
  readonly promptState: 'ENABLED' | 'DISABLED';
  readonly basePromptTemplate?: string;
  readonly modelResponseMaximumLength?: number;
  readonly stopSequences?: string[];
  readonly temperature?: number;
  readonly topP?: number;
  readonly topK?: number;
}

export interface BedrockAgentConstructProps {
  readonly bedrockAgentName: string;
  readonly awsPartition: string;
  readonly region: string;
  readonly instruction: string;
  readonly foundationModel: BedrockFoundationModel;
  readonly actionGroups: Array<CfnAgent.AgentActionGroupProperty>;
  readonly enableUserInput: boolean;
  readonly preProcessingPromptOverrideConfigurations?: PromptOverrideConfiguration;
  readonly orchestrationPromptOverrideConfigurations?: PromptOverrideConfiguration;
  readonly kbPromptOverrideConfigurations?: PromptOverrideConfiguration;
  readonly postProcessingPromptOverrideConfigurations?: PromptOverrideConfiguration;
}

export class BedrockAgentConstruct extends Construct {
  public readonly agent: CfnAgent;
  public readonly agentExecutionRole: Role;

  constructor(scope: Construct, id: string, props: BedrockAgentConstructProps) {
    super(scope, id);

    this.agentExecutionRole = CreateIAMRole(this, {
      roleId: `${props.agentName}ExecutionRole`,
      roleName: `BedrockExecutionRoleForAgents_${props.agentName}`,
      description: `IAM role for ${props.agentName}`,
      servicePrincipal: 'bedrock.amazonaws.com',
      managedPolicies: [
        new ManagedPolicy(this, `${props.agentName}CustomPolicy`, {
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['bedrock:InvokeModel'],
              resources: [`arn:${props.awsPartition}:bedrock:${props.region}::foundation-model/${props.foundationModel}`],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['bedrock:Retrieve', 'bedrock:RetrieveAndGenerate'],
              resources: ['*'],
            }),
          ],
        }),
      ],
    });

    if (props.enableUserInput) {
      props.actionGroups.push(
        {
          actionGroupName: 'UserInput',
          parentActionGroupSignature: 'AMAZON.UserInput',
          actionGroupState: 'ENABLED',
        },
      );
    }

    const promptOverrideConfigurationList = [];

    if (props.preProcessingPromptOverrideConfigurations) {
      promptOverrideConfigurationList.push({
        promptType: 'PRE_PROCESSING',
        ...this.generateOverrideConfiguration(props.preProcessingPromptOverrideConfigurations),
      });
    }

    if (props.orchestrationPromptOverrideConfigurations) {
      promptOverrideConfigurationList.push({
        promptType: 'ORCHESTRATION',
        ...this.generateOverrideConfiguration(props.orchestrationPromptOverrideConfigurations),
      });
    }

    if (props.kbPromptOverrideConfigurations) {
      promptOverrideConfigurationList.push({
        promptType: 'KNOWLEDGE_BASE_RESPONSE_GENERATION',
        ...this.generateOverrideConfiguration(props.kbPromptOverrideConfigurations),
      });
    }

    if (props.postProcessingPromptOverrideConfigurations) {
      promptOverrideConfigurationList.push({
        promptType: 'POST_PROCESSING',
        ...this.generateOverrideConfiguration(props.postProcessingPromptOverrideConfigurations),
      });
    }

    this.agent = new CfnAgent(this, props.agentName, {
      agentName: props.agentName,
      description: props.description,
      foundationModel: props.foundationModel,
      instruction: props.instruction,
      agentResourceRoleArn: this.agentExecutionRole.roleArn,
      actionGroups: props.actionGroups,
      promptOverrideConfiguration: {
        promptConfigurations: promptOverrideConfigurationList,
      },
      idleSessionTtlInSeconds: 1800,
      autoPrepare: true,
    });
  }

  private generateOverrideConfiguration(promptOverrideConfiguration: PromptOverrideConfiguration) {
    if (promptOverrideConfiguration.promptState === 'DISABLED') {
      return {};
    }

    return {
      promptState: promptOverrideConfiguration.promptState,
      promptCreationMode: 'OVERRIDDEN',
      basePromptTemplate: promptOverrideConfiguration.basePromptTemplate,
      inferenceConfiguration: {
        maximumLength: promptOverrideConfiguration.modelResponseMaximumLength,
        stopSequences: promptOverrideConfiguration.stopSequences,
        temperature: promptOverrideConfiguration.temperature,
        topP: promptOverrideConfiguration.topP,
        topK: promptOverrideConfiguration.topK,
      },
    };
  }
}
