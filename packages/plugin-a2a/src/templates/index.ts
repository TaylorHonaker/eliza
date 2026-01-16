/**
 * A2A Protocol Templates
 * Prompt templates for agent-to-agent communication and identity management
 */

export const registerIdentityTemplate = `You are an AI assistant helping to register an agent on the ERC-8004 Identity Registry.

The agent wants to create their on-chain identity. Please extract and validate the following information:

<recent_messages>
{{recentMessages}}
</recent_messages>

<agent_info>
Agent Name: {{agentName}}
Agent ID: {{agentId}}
Wallet Address: {{walletAddress}}
</agent_info>

Extract or confirm the following for the Agent Card:
1. Agent description (what the agent does)
2. Skills/specializations (list of capabilities)
3. Pricing model (if any)
4. Endpoint URL for A2A communication

Respond with a JSON markdown block containing the agent card details:

\`\`\`json
{
    "description": string,
    "skills": string[],
    "pricing": {
        "model": "per_request" | "per_token" | "subscription" | "custom" | null,
        "currency": string | null,
        "basePrice": string | null
    },
    "endpoint": string | null
}
\`\`\`
`;

export const a2aMessageTemplate = `You are processing an agent-to-agent (A2A) protocol message.

<a2a_message>
From: {{fromAgent}}
Message Type: {{messageType}}
Correlation ID: {{correlationId}}
Payload: {{payload}}
</a2a_message>

<agent_capabilities>
{{capabilities}}
</agent_capabilities>

<recent_context>
{{recentMessages}}
</recent_context>

Process this A2A message according to the message type:
- "request": Execute the requested action if within capabilities
- "query": Respond with capability information
- "negotiate": Consider the pricing/terms proposal
- "validate": Verify the work proof if applicable

Respond with a structured response that can be serialized as JSON:

\`\`\`json
{
    "success": boolean,
    "action": string | null,
    "response": string,
    "data": any | null,
    "error": {
        "code": string,
        "message": string
    } | null
}
\`\`\`
`;

export const agentDiscoveryTemplate = `You are helping an agent discover and evaluate other agents for collaboration.

<query>
{{query}}
</query>

<discovered_agents>
{{discoveredAgents}}
</discovered_agents>

<task_requirements>
{{taskRequirements}}
</task_requirements>

Analyze the discovered agents and recommend the best matches based on:
1. Capability alignment with task requirements
2. Pricing (if specified)
3. Reputation score (if available)
4. Response time expectations

Respond with your analysis and recommendations:

\`\`\`json
{
    "recommendedAgents": [
        {
            "agentId": string,
            "name": string,
            "matchScore": number,
            "reasoning": string,
            "estimatedCost": string | null
        }
    ],
    "analysis": string
}
\`\`\`
`;

export const workValidationTemplate = `You are validating work output from an agent task.

<task_request>
{{taskRequest}}
</task_request>

<task_output>
{{taskOutput}}
</task_output>

<validation_criteria>
{{validationCriteria}}
</validation_criteria>

Evaluate the work output against the original request and validation criteria.

Respond with your validation assessment:

\`\`\`json
{
    "isValid": boolean,
    "qualityScore": number,
    "completeness": number,
    "issues": string[],
    "recommendations": string[],
    "shouldPay": boolean,
    "reasoning": string
}
\`\`\`

Quality and completeness scores should be 0-100.
`;

export const pricingNegotiationTemplate = `You are handling a pricing negotiation between agents.

<current_pricing>
{{currentPricing}}
</current_pricing>

<proposed_terms>
{{proposedTerms}}
</proposed_terms>

<task_details>
{{taskDetails}}
</task_details>

<market_context>
{{marketContext}}
</market_context>

Evaluate the pricing proposal and determine the response:

\`\`\`json
{
    "accept": boolean,
    "counterOffer": {
        "currency": string,
        "amount": string,
        "model": string
    } | null,
    "reasoning": string,
    "finalTerms": {
        "currency": string,
        "amount": string,
        "model": string,
        "paymentMethod": string
    } | null
}
\`\`\`
`;
