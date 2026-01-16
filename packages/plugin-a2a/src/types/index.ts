import type { UUID } from "@elizaos/core";
import type { Address, Hash } from "viem";

/**
 * ERC-8004 Agent Card Schema
 * This follows the A2A (Agent-to-Agent) protocol specification for
 * decentralized agent identity and discovery.
 */
export interface AgentCard {
    /** Schema version for forward compatibility */
    version: "1.0";

    /** Unique identifier (matches ElizaOS agentId) */
    agentId: UUID;

    /** Human-readable agent name */
    name: string;

    /** Detailed description of agent capabilities */
    description: string;

    /** List of action names this agent can perform */
    capabilities: string[];

    /** Skills/specializations (e.g., "image-optimization", "trading", "research") */
    skills: string[];

    /** HTTP endpoint for A2A communication */
    endpoint: string;

    /** Agent's EVM wallet address for identity verification */
    walletAddress: Address;

    /** Optional public key for message encryption/signing */
    publicKey?: string;

    /** Timestamp of agent card creation */
    createdAt: number;

    /** Last update timestamp */
    updatedAt: number;

    /** Pricing information for agent services */
    pricing?: AgentPricing;

    /** Additional metadata */
    metadata: AgentMetadata;
}

/**
 * Pricing model for agent services
 */
export interface AgentPricing {
    /** Base currency for pricing (e.g., "ETH", "USDC", "sBTC") */
    currency: string;

    /** Price model type */
    model: "per_request" | "per_token" | "subscription" | "custom";

    /** Base price per unit */
    basePrice?: string;

    /** Price per 1000 tokens (for token-based pricing) */
    pricePerKToken?: string;

    /** Accepted payment tokens/currencies */
    acceptedCurrencies: string[];

    /** Optional Stacks/Bitcoin payment address for BTC settlement */
    btcPaymentAddress?: string;

    /** Optional Lightning Network invoice support */
    supportsLightning?: boolean;
}

/**
 * Agent metadata for discovery and compatibility
 */
export interface AgentMetadata {
    /** AI model provider (e.g., "openai", "anthropic", "local") */
    modelProvider?: string;

    /** Character/persona name */
    character?: string;

    /** Active plugins */
    plugins?: string[];

    /** Supported input formats */
    inputFormats?: string[];

    /** Supported output formats */
    outputFormats?: string[];

    /** Maximum request size in bytes */
    maxRequestSize?: number;

    /** Average response time in milliseconds */
    avgResponseTimeMs?: number;

    /** Reputation score (0-100) */
    reputationScore?: number;

    /** Total completed jobs */
    completedJobs?: number;

    /** Custom metadata fields */
    [key: string]: unknown;
}

/**
 * ERC-8004 Identity Registry types
 */
export interface AgentIdentity {
    /** Token ID in the Identity Registry */
    tokenId: bigint;

    /** Owner address */
    owner: Address;

    /** IPFS/Arweave URI to Agent Card */
    tokenURI: string;

    /** Registration timestamp */
    registeredAt: number;

    /** Transaction hash of registration */
    registrationTx: Hash;
}

/**
 * A2A Protocol Message Types
 */
export interface A2AMessage {
    /** Message ID for tracking */
    id: string;

    /** Source agent identifier */
    from: UUID | Address;

    /** Target agent identifier */
    to: UUID | Address;

    /** Message type */
    type: A2AMessageType;

    /** Message payload */
    payload: A2APayload;

    /** Unix timestamp */
    timestamp: number;

    /** Optional signature for verification */
    signature?: string;

    /** Optional correlation ID for request-response matching */
    correlationId?: string;
}

export type A2AMessageType =
    | "request"      // Task request
    | "response"     // Task response
    | "query"        // Capability query
    | "announce"     // Capability announcement
    | "negotiate"    // Pricing negotiation
    | "validate"     // Work validation request
    | "payment"      // Payment notification
    | "error";       // Error message

export interface A2APayload {
    /** Action to perform (for requests) */
    action?: string;

    /** Input data */
    input?: unknown;

    /** Output data (for responses) */
    output?: unknown;

    /** Error details */
    error?: A2AError;

    /** Validation proof (for validate messages) */
    proof?: ValidationProof;

    /** Payment details (for payment messages) */
    payment?: PaymentDetails;
}

export interface A2AError {
    code: string;
    message: string;
    details?: unknown;
}

export interface ValidationProof {
    /** Work output hash */
    outputHash: string;

    /** Proof method (e.g., "merkle", "zk", "attestation") */
    method: string;

    /** Proof data */
    data: string;

    /** Validator signatures */
    signatures?: string[];
}

export interface PaymentDetails {
    /** Amount in smallest unit */
    amount: string;

    /** Currency/token */
    currency: string;

    /** Transaction hash */
    txHash?: Hash;

    /** Chain ID */
    chainId?: number;

    /** Payment status */
    status: "pending" | "confirmed" | "failed";
}

/**
 * A2A Protocol Response
 */
export interface A2AResponse {
    /** Whether the request was successful */
    success: boolean;

    /** Response data */
    data?: unknown;

    /** Error information */
    error?: A2AError;

    /** Correlation ID matching the request */
    correlationId?: string;

    /** Response metadata */
    metadata?: {
        processingTimeMs: number;
        tokensUsed?: number;
        cost?: string;
    };
}

/**
 * Configuration for the A2A plugin
 */
export interface A2APluginConfig {
    /** Port for the A2A HTTP server */
    port?: number;

    /** Host for the A2A HTTP server */
    host?: string;

    /** Base URL for agent endpoint (for Agent Card) */
    baseUrl?: string;

    /** ERC-8004 Identity Registry contract address */
    identityRegistryAddress?: Address;

    /** Validation Registry contract address */
    validationRegistryAddress?: Address;

    /** Chain to use for identity operations */
    chain?: string;

    /** Enable request signing */
    enableSigning?: boolean;

    /** Enable request validation */
    enableValidation?: boolean;

    /** Maximum request size in bytes */
    maxRequestSize?: number;

    /** Request timeout in milliseconds */
    requestTimeout?: number;
}

/**
 * Contract ABIs for ERC-8004
 */
export const ERC8004_IDENTITY_REGISTRY_ABI = [
    {
        name: "mint",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "tokenURI", type: "string" }
        ],
        outputs: [{ name: "tokenId", type: "uint256" }]
    },
    {
        name: "burn",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: []
    },
    {
        name: "tokenURI",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "string" }]
    },
    {
        name: "ownerOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "address" }]
    },
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "", type: "uint256" }]
    },
    {
        name: "tokenOfOwnerByIndex",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "index", type: "uint256" }
        ],
        outputs: [{ name: "", type: "uint256" }]
    },
    {
        name: "setTokenURI",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "tokenId", type: "uint256" },
            { name: "tokenURI", type: "string" }
        ],
        outputs: []
    },
    {
        name: "Transfer",
        type: "event",
        inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "tokenId", type: "uint256", indexed: true }
        ]
    }
] as const;

export const ERC8004_VALIDATION_REGISTRY_ABI = [
    {
        name: "submitValidation",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "agentId", type: "uint256" },
            { name: "taskHash", type: "bytes32" },
            { name: "resultHash", type: "bytes32" },
            { name: "proof", type: "bytes" }
        ],
        outputs: [{ name: "validationId", type: "uint256" }]
    },
    {
        name: "getValidation",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "validationId", type: "uint256" }],
        outputs: [
            { name: "agentId", type: "uint256" },
            { name: "taskHash", type: "bytes32" },
            { name: "resultHash", type: "bytes32" },
            { name: "timestamp", type: "uint256" },
            { name: "verified", type: "bool" }
        ]
    },
    {
        name: "ValidationSubmitted",
        type: "event",
        inputs: [
            { name: "validationId", type: "uint256", indexed: true },
            { name: "agentId", type: "uint256", indexed: true },
            { name: "taskHash", type: "bytes32" },
            { name: "resultHash", type: "bytes32" }
        ]
    }
] as const;

/**
 * Default contract addresses (to be updated with actual deployments)
 */
export const DEFAULT_IDENTITY_REGISTRY_ADDRESS: Address =
    "0x0000000000000000000000000000000000000000";

export const DEFAULT_VALIDATION_REGISTRY_ADDRESS: Address =
    "0x0000000000000000000000000000000000000000";
