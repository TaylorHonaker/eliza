import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    ServiceType,
} from "@elizaos/core";
import type { A2AService } from "../services/a2aService";
import type { AgentCard } from "../types";

/**
 * Agent Capabilities Provider
 * Injects the agent's A2A capabilities and identity information into the context
 */
export const agentCapabilitiesProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        _message: Memory,
        state?: State
    ): Promise<string | null> {
        try {
            // Get the A2A service if available
            const a2aService = runtime.getService<A2AService>(
                "a2a" as ServiceType
            );

            const agentCard = a2aService?.getAgentCard();
            const agentName = state?.agentName || runtime.character.name;

            // Build capabilities list from registered actions
            const capabilities = runtime.actions.map((action) => ({
                name: action.name,
                description: action.description,
                similes: action.similes,
            }));

            // Build the context string
            let contextStr = `${agentName}'s A2A Identity & Capabilities:\n`;
            contextStr += `Agent ID: ${runtime.agentId}\n`;
            contextStr += `Name: ${runtime.character.name}\n`;

            if (agentCard) {
                contextStr += `\nAgent Card (ERC-8004 Identity):\n`;
                contextStr += `- Wallet: ${agentCard.walletAddress}\n`;
                contextStr += `- Endpoint: ${agentCard.endpoint}\n`;
                contextStr += `- Skills: ${agentCard.skills.join(", ") || "None specified"}\n`;

                if (agentCard.pricing) {
                    contextStr += `- Pricing: ${agentCard.pricing.model} (${agentCard.pricing.currency})\n`;
                }
            }

            contextStr += `\nRegistered Capabilities:\n`;
            for (const cap of capabilities) {
                contextStr += `- ${cap.name}: ${cap.description}\n`;
            }

            if (a2aService?.isRunning()) {
                contextStr += `\nA2A Service: Active at ${a2aService.getEndpoint()}`;
            } else {
                contextStr += `\nA2A Service: Not running`;
            }

            return contextStr;
        } catch (error) {
            console.error("Error in agent capabilities provider:", error);
            return null;
        }
    },
};

/**
 * Agent Identity Provider
 * Provides on-chain identity information to the context
 */
export const agentIdentityProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        _message: Memory,
        state?: State
    ): Promise<string | null> {
        try {
            const a2aService = runtime.getService<A2AService>(
                "a2a" as ServiceType
            );
            const agentCard = a2aService?.getAgentCard();

            if (!agentCard) {
                return `${state?.agentName || runtime.character.name} does not have a registered on-chain identity yet. Use the REGISTER_IDENTITY action to create one.`;
            }

            let identityStr = `On-Chain Identity (ERC-8004):\n`;
            identityStr += `- Name: ${agentCard.name}\n`;
            identityStr += `- Wallet: ${agentCard.walletAddress}\n`;
            identityStr += `- Description: ${agentCard.description}\n`;
            identityStr += `- Capabilities: ${agentCard.capabilities.length} actions\n`;
            identityStr += `- Skills: ${agentCard.skills.join(", ") || "General purpose"}\n`;
            identityStr += `- Created: ${new Date(agentCard.createdAt).toISOString()}\n`;

            if (agentCard.metadata?.reputationScore !== undefined) {
                identityStr += `- Reputation: ${agentCard.metadata.reputationScore}/100\n`;
            }

            if (agentCard.metadata?.completedJobs !== undefined) {
                identityStr += `- Completed Jobs: ${agentCard.metadata.completedJobs}\n`;
            }

            return identityStr;
        } catch (error) {
            console.error("Error in agent identity provider:", error);
            return null;
        }
    },
};

/**
 * Pricing Provider
 * Provides pricing information for A2A negotiations
 */
export const agentPricingProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ): Promise<string | null> {
        try {
            const a2aService = runtime.getService<A2AService>(
                "a2a" as ServiceType
            );
            const agentCard = a2aService?.getAgentCard();

            if (!agentCard?.pricing) {
                return `No pricing information configured. This agent accepts tasks on a case-by-case basis.`;
            }

            const pricing = agentCard.pricing;

            let pricingStr = `Agent Pricing Information:\n`;
            pricingStr += `- Model: ${pricing.model}\n`;
            pricingStr += `- Currency: ${pricing.currency}\n`;

            if (pricing.basePrice) {
                pricingStr += `- Base Price: ${pricing.basePrice} ${pricing.currency}\n`;
            }

            if (pricing.pricePerKToken) {
                pricingStr += `- Price per 1K tokens: ${pricing.pricePerKToken} ${pricing.currency}\n`;
            }

            pricingStr += `- Accepted Currencies: ${pricing.acceptedCurrencies.join(", ")}\n`;

            if (pricing.btcPaymentAddress) {
                pricingStr += `- BTC/Stacks Payment Address: ${pricing.btcPaymentAddress}\n`;
            }

            if (pricing.supportsLightning) {
                pricingStr += `- Lightning Network: Supported\n`;
            }

            return pricingStr;
        } catch (error) {
            console.error("Error in agent pricing provider:", error);
            return null;
        }
    },
};
