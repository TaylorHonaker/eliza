/**
 * @elizaos/plugin-a2a
 *
 * ERC-8004 Agent Identity & A2A (Agent-to-Agent) Protocol Plugin for ElizaOS
 *
 * This plugin enables agents to:
 * - Register verifiable on-chain identities via ERC-8004
 * - Communicate with other agents via the A2A protocol
 * - Discover and query remote agents
 * - Expose capabilities via Agent Card (A2A spec)
 *
 * Key Features:
 * - REGISTER_IDENTITY action: Mint an ERC-8004 NFT representing agent identity
 * - A2A Service: HTTP server for agent-to-agent communication
 * - Agent Card: JSON schema following A2A spec for discovery
 * - Multi-chain support: Ethereum, Base, Sepolia
 * - Bitcoin/Stacks settlement support via pricing configuration
 *
 * Configuration (environment variables or runtime settings):
 * - EVM_PRIVATE_KEY: Private key for blockchain transactions
 * - A2A_PORT: Port for A2A HTTP server (default: 3001)
 * - A2A_HOST: Host for A2A server (default: 0.0.0.0)
 * - A2A_BASE_URL: Public URL for agent endpoint
 * - A2A_IDENTITY_REGISTRY_ADDRESS: ERC-8004 registry contract address
 * - A2A_CHAIN: Chain for identity operations (mainnet, sepolia, base)
 *
 * @example
 * ```typescript
 * import { a2aPlugin } from "@elizaos/plugin-a2a";
 *
 * const runtime = new AgentRuntime({
 *   // ... other config
 *   plugins: [a2aPlugin],
 * });
 * ```
 */

// Export types
export * from "./types";

// Export templates
export * from "./templates";

// Export actions
export { registerIdentityAction, buildAgentCard } from "./actions/registerIdentity";
export { sendA2AMessageAction, queryAgentAction } from "./actions/sendA2AMessage";

// Export providers
export {
    agentCapabilitiesProvider,
    agentIdentityProvider,
    agentPricingProvider,
} from "./providers/capabilities";

// Export services
export { A2AService, createA2AService, type IA2AService } from "./services/a2aService";

// Import for plugin definition
import type { Plugin } from "@elizaos/core";
import { registerIdentityAction } from "./actions/registerIdentity";
import { sendA2AMessageAction, queryAgentAction } from "./actions/sendA2AMessage";
import {
    agentCapabilitiesProvider,
    agentIdentityProvider,
    agentPricingProvider,
} from "./providers/capabilities";
import { createA2AService } from "./services/a2aService";

/**
 * A2A Plugin
 *
 * Provides ERC-8004 agent identity and A2A protocol support for ElizaOS agents.
 *
 * Actions:
 * - REGISTER_IDENTITY: Register agent on ERC-8004 Identity Registry
 * - SEND_A2A_MESSAGE: Send messages to other agents
 * - QUERY_AGENT: Discover remote agent capabilities
 *
 * Providers:
 * - agentCapabilitiesProvider: Injects agent capabilities into context
 * - agentIdentityProvider: Injects on-chain identity into context
 * - agentPricingProvider: Injects pricing information into context
 *
 * Services:
 * - A2AService: HTTP server for receiving A2A messages
 */
export const a2aPlugin: Plugin = {
    name: "a2a",
    description:
        "ERC-8004 Agent Identity & A2A Protocol plugin for verifiable agent communication",
    actions: [registerIdentityAction, sendA2AMessageAction, queryAgentAction],
    providers: [
        agentCapabilitiesProvider,
        agentIdentityProvider,
        agentPricingProvider,
    ],
    evaluators: [],
    services: [createA2AService()],
};

export default a2aPlugin;
