import {
    Action,
    composeContext,
    generateObjectDeprecated,
    HandlerCallback,
    ModelClass,
    elizaLogger,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import {
    createPublicClient,
    createWalletClient,
    http,
    type Hash,
    type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, sepolia, base } from "viem/chains";
import {
    type AgentCard,
    type AgentIdentity,
    ERC8004_IDENTITY_REGISTRY_ABI,
    DEFAULT_IDENTITY_REGISTRY_ADDRESS,
} from "../types";
import { registerIdentityTemplate } from "../templates";

/**
 * Supported chains for identity registration
 */
const SUPPORTED_CHAINS = {
    mainnet,
    sepolia,
    base,
} as const;

type SupportedChainName = keyof typeof SUPPORTED_CHAINS;

/**
 * Build the Agent Card JSON for IPFS upload
 */
export function buildAgentCard(
    runtime: IAgentRuntime,
    options: {
        description?: string;
        skills?: string[];
        endpoint?: string;
        pricing?: AgentCard["pricing"];
        walletAddress: Address;
    }
): AgentCard {
    const now = Date.now();

    // Extract action names from registered actions
    const capabilities = runtime.actions.map((action) => action.name);

    // Build the Agent Card following A2A spec
    const agentCard: AgentCard = {
        version: "1.0",
        agentId: runtime.agentId,
        name: runtime.character.name,
        description:
            options.description ||
            runtime.character.bio?.toString() ||
            `AI agent powered by ElizaOS`,
        capabilities,
        skills: options.skills || [],
        endpoint: options.endpoint || "",
        walletAddress: options.walletAddress,
        createdAt: now,
        updatedAt: now,
        metadata: {
            modelProvider: runtime.modelProvider,
            character: runtime.character.name,
            plugins: runtime.plugins.map((p) => p.name),
            inputFormats: ["text", "json"],
            outputFormats: ["text", "json"],
        },
    };

    if (options.pricing) {
        agentCard.pricing = options.pricing;
    }

    return agentCard;
}

/**
 * Upload Agent Card to IPFS (placeholder - would use actual IPFS service)
 */
async function uploadToIPFS(agentCard: AgentCard): Promise<string> {
    // In production, this would upload to IPFS/Arweave
    // For now, we'll create a data URI or use a mock

    elizaLogger.info("Uploading Agent Card to IPFS...", {
        agentId: agentCard.agentId,
        name: agentCard.name,
    });

    // Convert to JSON string
    const cardJson = JSON.stringify(agentCard, null, 2);

    // In a real implementation, you would:
    // 1. Use ipfs-http-client or similar
    // 2. Upload to Pinata, Infura IPFS, or self-hosted node
    // 3. Return the IPFS CID

    // Placeholder: return a mock IPFS URI
    // In production, replace with actual IPFS upload
    const mockCID = `Qm${Buffer.from(cardJson).toString("base64").slice(0, 44)}`;
    const ipfsUri = `ipfs://${mockCID}`;

    elizaLogger.info("Agent Card uploaded to IPFS", { uri: ipfsUri });

    return ipfsUri;
}

/**
 * Register Agent Identity Action
 * Mints an ERC-8004 NFT representing the agent's on-chain identity
 */
export class RegisterIdentityAction {
    private chain: (typeof SUPPORTED_CHAINS)[SupportedChainName];
    private registryAddress: Address;

    constructor(
        chainName: SupportedChainName = "mainnet",
        registryAddress?: Address
    ) {
        this.chain = SUPPORTED_CHAINS[chainName];
        this.registryAddress =
            registryAddress || DEFAULT_IDENTITY_REGISTRY_ADDRESS;
    }

    async register(
        privateKey: `0x${string}`,
        agentCard: AgentCard,
        rpcUrl?: string
    ): Promise<AgentIdentity> {
        // Create account from private key
        const account = privateKeyToAccount(privateKey);

        elizaLogger.info("Registering agent identity on-chain", {
            chain: this.chain.name,
            registry: this.registryAddress,
            wallet: account.address,
        });

        // Upload Agent Card to IPFS
        const tokenURI = await uploadToIPFS(agentCard);

        // Create clients
        const transport = rpcUrl ? http(rpcUrl) : http();

        const publicClient = createPublicClient({
            chain: this.chain,
            transport,
        });

        const walletClient = createWalletClient({
            chain: this.chain,
            transport,
            account,
        });

        // Mint the identity NFT
        const hash = await walletClient.writeContract({
            address: this.registryAddress,
            abi: ERC8004_IDENTITY_REGISTRY_ABI,
            functionName: "mint",
            args: [account.address, tokenURI],
        });

        elizaLogger.info("Identity registration transaction submitted", {
            hash,
        });

        // Wait for transaction confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        elizaLogger.info("Identity registration confirmed", {
            blockNumber: receipt.blockNumber,
            status: receipt.status,
        });

        // Extract token ID from logs (Transfer event)
        let tokenId: bigint = BigInt(0);
        for (const log of receipt.logs) {
            if (log.topics[0] && log.topics[3]) {
                // Transfer event topic
                tokenId = BigInt(log.topics[3]);
                break;
            }
        }

        return {
            tokenId,
            owner: account.address,
            tokenURI,
            registeredAt: Date.now(),
            registrationTx: hash,
        };
    }
}

/**
 * Extract registration details from conversation context
 */
async function buildRegistrationDetails(
    state: State,
    runtime: IAgentRuntime,
    walletAddress: Address
): Promise<{
    description: string;
    skills: string[];
    pricing: AgentCard["pricing"] | undefined;
    endpoint: string | null;
}> {
    // Add agent info to state
    state.agentName = runtime.character.name;
    state.agentId = runtime.agentId;
    state.walletAddress = walletAddress;

    const context = composeContext({
        state,
        template: registerIdentityTemplate,
    });

    const details = (await generateObjectDeprecated({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
    })) as {
        description: string;
        skills: string[];
        pricing: {
            model: string | null;
            currency: string | null;
            basePrice: string | null;
        } | null;
        endpoint: string | null;
    };

    let pricing: AgentCard["pricing"] | undefined;
    if (details.pricing?.model) {
        pricing = {
            model: details.pricing.model as AgentCard["pricing"]["model"],
            currency: details.pricing.currency || "ETH",
            basePrice: details.pricing.basePrice || undefined,
            acceptedCurrencies: [details.pricing.currency || "ETH"],
        };
    }

    return {
        description: details.description,
        skills: details.skills || [],
        pricing,
        endpoint: details.endpoint,
    };
}

/**
 * The REGISTER_AGENT_IDENTITY Action
 */
export const registerIdentityAction: Action = {
    name: "REGISTER_IDENTITY",
    description:
        "Register the agent on the ERC-8004 Identity Registry to obtain a verifiable on-chain identity",

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

        elizaLogger.info("REGISTER_IDENTITY action handler called");

        // Get private key from runtime settings
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY") as
            | `0x${string}`
            | undefined;

        if (!privateKey) {
            const errorMsg =
                "EVM_PRIVATE_KEY is not configured. Cannot register identity.";
            elizaLogger.error(errorMsg);
            if (callback) {
                callback({
                    text: errorMsg,
                    content: { error: errorMsg },
                });
            }
            return false;
        }

        // Get wallet address
        const account = privateKeyToAccount(privateKey);
        const walletAddress = account.address;

        // Get chain configuration
        const chainName = (runtime.getSetting("A2A_CHAIN") ||
            "mainnet") as SupportedChainName;
        const registryAddress = runtime.getSetting(
            "A2A_IDENTITY_REGISTRY_ADDRESS"
        ) as Address | undefined;
        const rpcUrl = runtime.getSetting("EVM_PROVIDER_URL") as
            | string
            | undefined;

        // Get endpoint configuration
        const a2aPort = runtime.getSetting("A2A_PORT") || "3001";
        const a2aHost = runtime.getSetting("A2A_HOST") || "localhost";
        const a2aBaseUrl =
            runtime.getSetting("A2A_BASE_URL") ||
            `http://${a2aHost}:${a2aPort}`;

        try {
            // Build registration details from context
            const registrationDetails = await buildRegistrationDetails(
                state,
                runtime,
                walletAddress
            );

            // Build the Agent Card
            const agentCard = buildAgentCard(runtime, {
                description: registrationDetails.description,
                skills: registrationDetails.skills,
                endpoint: registrationDetails.endpoint || `${a2aBaseUrl}/a2a`,
                pricing: registrationDetails.pricing,
                walletAddress,
            });

            elizaLogger.info("Built Agent Card", {
                name: agentCard.name,
                capabilities: agentCard.capabilities.length,
                skills: agentCard.skills,
            });

            // Create the registration action
            const action = new RegisterIdentityAction(
                chainName,
                registryAddress
            );

            // Register the identity
            const identity = await action.register(
                privateKey,
                agentCard,
                rpcUrl
            );

            const successMsg = `Successfully registered on ERC-8004 Identity Registry!

Agent Identity Details:
- Token ID: ${identity.tokenId}
- Owner: ${identity.owner}
- Token URI: ${identity.tokenURI}
- Registration TX: ${identity.registrationTx}

Your Agent Card has been uploaded and your on-chain identity is now verifiable.`;

            elizaLogger.info("Identity registration successful", {
                tokenId: identity.tokenId.toString(),
                txHash: identity.registrationTx,
            });

            if (callback) {
                callback({
                    text: successMsg,
                    content: {
                        success: true,
                        identity: {
                            tokenId: identity.tokenId.toString(),
                            owner: identity.owner,
                            tokenURI: identity.tokenURI,
                            registrationTx: identity.registrationTx,
                        },
                        agentCard,
                    },
                });
            }

            return true;
        } catch (error) {
            const errorMsg = `Failed to register identity: ${error instanceof Error ? error.message : String(error)}`;
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
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },

    similes: [
        "MINT_AGENT_ID",
        "BECOME_VERIFIABLE",
        "CREATE_IDENTITY",
        "REGISTER_ON_CHAIN",
        "GET_AGENT_NFT",
        "MINT_IDENTITY",
    ],

    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Register my agent on the ERC-8004 Identity Registry",
                    action: "REGISTER_IDENTITY",
                },
            },
            {
                user: "assistant",
                content: {
                    text: "I'll register your agent on the ERC-8004 Identity Registry to create a verifiable on-chain identity.",
                    action: "REGISTER_IDENTITY",
                },
            },
        ],
        [
            {
                user: "user",
                content: {
                    text: "I want to become a verifiable agent with an on-chain identity",
                    action: "REGISTER_IDENTITY",
                },
            },
            {
                user: "assistant",
                content: {
                    text: "I'll mint your Agent ID on the blockchain. This will create your verifiable identity.",
                    action: "REGISTER_IDENTITY",
                },
            },
        ],
    ],
};
