import {
    Action,
    composeContext,
    generateObjectDeprecated,
    HandlerCallback,
    ModelClass,
    elizaLogger,
    ServiceType,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";
import type { A2AService } from "../services/a2aService";
import type { A2AMessage, A2AMessageType, AgentCard } from "../types";

/**
 * Template for extracting A2A message details from conversation
 */
const sendA2AMessageTemplate = `You are helping an agent send a message to another agent via the A2A protocol.

<recent_messages>
{{recentMessages}}
</recent_messages>

<known_agents>
{{knownAgents}}
</known_agents>

Extract the following information for the A2A message:
1. Target agent (endpoint URL or known agent name)
2. Message type (request, query, negotiate, validate)
3. Action to request (if applicable)
4. Message payload/content

Respond with a JSON markdown block:

\`\`\`json
{
    "targetEndpoint": string,
    "messageType": "request" | "query" | "negotiate" | "validate",
    "action": string | null,
    "payload": any
}
\`\`\`
`;

/**
 * Discover an agent by fetching their Agent Card
 */
async function discoverAgent(endpoint: string): Promise<AgentCard | null> {
    try {
        // Try well-known path first
        let response = await fetch(`${endpoint}/.well-known/agent-card`, {
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            // Try alternative path
            response = await fetch(`${endpoint}/agent-card`, {
                signal: AbortSignal.timeout(10000),
            });
        }

        if (!response.ok) {
            return null;
        }

        return (await response.json()) as AgentCard;
    } catch (error) {
        elizaLogger.warn(`Failed to discover agent at ${endpoint}:`, error);
        return null;
    }
}

/**
 * Send A2A Message Action
 * Allows the agent to send messages to other agents via the A2A protocol
 */
export const sendA2AMessageAction: Action = {
    name: "SEND_A2A_MESSAGE",
    description:
        "Send a message to another agent via the A2A (Agent-to-Agent) protocol",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: HandlerCallback
    ) => {
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        elizaLogger.info("SEND_A2A_MESSAGE action handler called");

        // Get A2A service
        const a2aService = runtime.getService<A2AService>(
            "a2a" as ServiceType
        );

        if (!a2aService) {
            const errorMsg = "A2A service is not available";
            elizaLogger.error(errorMsg);
            if (callback) {
                callback({
                    text: errorMsg,
                    content: { error: errorMsg },
                });
            }
            return false;
        }

        try {
            // Add known agents to state (could be from a registry or cache)
            state.knownAgents =
                "No known agents cached. Please provide the target endpoint URL.";

            // Extract message details from context
            const context = composeContext({
                state,
                template: sendA2AMessageTemplate,
            });

            const messageDetails = (await generateObjectDeprecated({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
            })) as {
                targetEndpoint: string;
                messageType: A2AMessageType;
                action: string | null;
                payload: unknown;
            };

            if (!messageDetails.targetEndpoint) {
                const errorMsg =
                    "Could not determine target agent endpoint. Please specify the endpoint URL.";
                if (callback) {
                    callback({
                        text: errorMsg,
                        content: { error: errorMsg },
                    });
                }
                return false;
            }

            // Discover the target agent
            const targetAgent = await discoverAgent(
                messageDetails.targetEndpoint
            );
            if (targetAgent) {
                elizaLogger.info("Discovered target agent", {
                    name: targetAgent.name,
                    capabilities: targetAgent.capabilities.length,
                });
            }

            // Build the A2A message
            const a2aMessage: A2AMessage = {
                id: uuidv4(),
                from: runtime.agentId,
                to: targetAgent?.agentId || messageDetails.targetEndpoint,
                type: messageDetails.messageType,
                payload: {
                    action: messageDetails.action || undefined,
                    input: messageDetails.payload,
                },
                timestamp: Date.now(),
                correlationId: uuidv4(),
            };

            elizaLogger.info("Sending A2A message", {
                to: messageDetails.targetEndpoint,
                type: a2aMessage.type,
                correlationId: a2aMessage.correlationId,
            });

            // Send the message
            const response = await a2aService.sendMessage(
                messageDetails.targetEndpoint,
                a2aMessage
            );

            if (response.success) {
                const successMsg = `Successfully sent A2A message to ${targetAgent?.name || messageDetails.targetEndpoint}

Message Details:
- Type: ${a2aMessage.type}
- Correlation ID: ${a2aMessage.correlationId}
- Processing Time: ${response.metadata?.processingTimeMs}ms

Response: ${JSON.stringify(response.data, null, 2)}`;

                elizaLogger.info("A2A message sent successfully", {
                    correlationId: a2aMessage.correlationId,
                });

                if (callback) {
                    callback({
                        text: successMsg,
                        content: {
                            success: true,
                            message: a2aMessage,
                            response: response,
                        },
                    });
                }
                return true;
            } else {
                const errorMsg = `Failed to send A2A message: ${response.error?.message || "Unknown error"}`;
                elizaLogger.error(errorMsg);

                if (callback) {
                    callback({
                        text: errorMsg,
                        content: {
                            success: false,
                            error: response.error,
                        },
                    });
                }
                return false;
            }
        } catch (error) {
            const errorMsg = `Error sending A2A message: ${error instanceof Error ? error.message : String(error)}`;
            elizaLogger.error(errorMsg, { error });

            if (callback) {
                callback({
                    text: errorMsg,
                    content: { error: errorMsg },
                });
            }
            return false;
        }
    },

    validate: async (runtime: IAgentRuntime) => {
        // Check if A2A service is available
        const a2aService = runtime.getService<A2AService>(
            "a2a" as ServiceType
        );
        return a2aService?.isRunning() || false;
    },

    similes: [
        "MESSAGE_AGENT",
        "CONTACT_AGENT",
        "SEND_TO_AGENT",
        "A2A_REQUEST",
        "AGENT_COMMUNICATION",
    ],

    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Send a message to the agent at http://agent.example.com asking about their capabilities",
                    action: "SEND_A2A_MESSAGE",
                },
            },
            {
                user: "assistant",
                content: {
                    text: "I'll send an A2A query message to discover that agent's capabilities.",
                    action: "SEND_A2A_MESSAGE",
                },
            },
        ],
        [
            {
                user: "user",
                content: {
                    text: "Request the image optimization agent to process this image",
                    action: "SEND_A2A_MESSAGE",
                },
            },
            {
                user: "assistant",
                content: {
                    text: "I'll send an A2A request to the image optimization agent.",
                    action: "SEND_A2A_MESSAGE",
                },
            },
        ],
    ],
};

/**
 * Query Remote Agent Action
 * Query another agent's capabilities and status
 */
export const queryAgentAction: Action = {
    name: "QUERY_AGENT",
    description:
        "Query another agent to discover their capabilities, pricing, and availability",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: HandlerCallback
    ) => {
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        elizaLogger.info("QUERY_AGENT action handler called");

        // Extract the endpoint from the message
        const messageText = message.content?.text || "";
        const urlMatch = messageText.match(
            /https?:\/\/[^\s]+|localhost:\d+|[\w.-]+:\d+/i
        );

        if (!urlMatch) {
            const errorMsg =
                "Please provide the agent endpoint URL to query (e.g., http://agent.example.com:3001)";
            if (callback) {
                callback({
                    text: errorMsg,
                    content: { error: errorMsg },
                });
            }
            return false;
        }

        let endpoint = urlMatch[0];
        if (!endpoint.startsWith("http")) {
            endpoint = `http://${endpoint}`;
        }

        try {
            // Discover the agent
            const agentCard = await discoverAgent(endpoint);

            if (!agentCard) {
                const errorMsg = `Could not discover agent at ${endpoint}. The agent may not be running or doesn't support the A2A protocol.`;
                if (callback) {
                    callback({
                        text: errorMsg,
                        content: { error: errorMsg },
                    });
                }
                return false;
            }

            // Fetch capabilities endpoint for more details
            let capabilities = agentCard.capabilities;
            try {
                const capResponse = await fetch(`${endpoint}/a2a/capabilities`, {
                    signal: AbortSignal.timeout(10000),
                });
                if (capResponse.ok) {
                    const capData = await capResponse.json();
                    capabilities = capData.capabilities || capabilities;
                }
            } catch {
                // Use agent card capabilities
            }

            const resultMsg = `Agent Discovery Results for ${endpoint}:

Name: ${agentCard.name}
Agent ID: ${agentCard.agentId}
Description: ${agentCard.description}

Wallet Address: ${agentCard.walletAddress}
A2A Endpoint: ${agentCard.endpoint}

Skills: ${agentCard.skills.join(", ") || "Not specified"}

Capabilities (${capabilities.length} actions):
${capabilities.map((c: string | { name: string; description?: string }) => `- ${typeof c === "string" ? c : `${c.name}: ${c.description || ""}`}`).join("\n")}

${
    agentCard.pricing
        ? `Pricing:
- Model: ${agentCard.pricing.model}
- Currency: ${agentCard.pricing.currency}
- Base Price: ${agentCard.pricing.basePrice || "Not specified"}
- Accepted: ${agentCard.pricing.acceptedCurrencies.join(", ")}`
        : "Pricing: Not specified"
}

${
    agentCard.metadata?.reputationScore !== undefined
        ? `Reputation: ${agentCard.metadata.reputationScore}/100`
        : ""
}`;

            elizaLogger.info("Agent discovery successful", {
                name: agentCard.name,
                endpoint,
            });

            if (callback) {
                callback({
                    text: resultMsg,
                    content: {
                        success: true,
                        agentCard,
                        capabilities,
                    },
                });
            }
            return true;
        } catch (error) {
            const errorMsg = `Error querying agent: ${error instanceof Error ? error.message : String(error)}`;
            elizaLogger.error(errorMsg, { error });

            if (callback) {
                callback({
                    text: errorMsg,
                    content: { error: errorMsg },
                });
            }
            return false;
        }
    },

    validate: async () => true,

    similes: [
        "DISCOVER_AGENT",
        "FIND_AGENT",
        "GET_AGENT_INFO",
        "CHECK_AGENT",
        "AGENT_LOOKUP",
    ],

    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Query the agent at http://localhost:3001 to see what it can do",
                    action: "QUERY_AGENT",
                },
            },
            {
                user: "assistant",
                content: {
                    text: "I'll discover that agent's capabilities and pricing information.",
                    action: "QUERY_AGENT",
                },
            },
        ],
    ],
};
