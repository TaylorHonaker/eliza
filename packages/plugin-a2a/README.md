# @elizaos/plugin-a2a

ERC-8004 Agent Identity & A2A (Agent-to-Agent) Protocol Plugin for ElizaOS.

## Overview

This plugin enables ElizaOS agents to:

1. **Register Verifiable On-Chain Identities** - Mint ERC-8004 NFTs representing agent identity
2. **Communicate with Other Agents** - HTTP-based A2A protocol for agent-to-agent messaging
3. **Expose Agent Cards** - Standard JSON schema for agent discovery (A2A spec compliant)
4. **Support Multi-Currency Settlement** - ETH, stablecoins, and Bitcoin/Stacks payment options

## The "Trustless Builder" Pipeline

This plugin implements the 4-step pipeline for building industrial-grade service agents:

### Step 1: The "Passport" (On-Chain Identity)

Your agent gets a verifiable identity via the ERC-8004 Identity Registry:

```typescript
// Agent uses REGISTER_IDENTITY action to mint their AgentID NFT
// The Agent Card (JSON) is uploaded to IPFS and linked to the NFT
```

### Step 2: The "Brain" (A2A Protocol)

Instead of just Twitter/Discord, your agent speaks HTTP to other agents:

```typescript
// POST /a2a/message endpoint receives structured requests
// Agent processes and responds with structured JSON
```

### Step 3: The "Hands" (EVM Integration)

Self-registration and on-chain identity management:

```typescript
// REGISTER_IDENTITY action mints the ERC-8004 NFT
// Agent Card contains capabilities, pricing, and wallet address
```

### Step 4: The "Settlement" (Bitcoin/Stacks Play)

Support for multi-currency settlement including BTC:

```typescript
// Agent Card pricing supports btcPaymentAddress for Stacks settlement
// Use Ethereum for identity/reputation, Bitcoin for settlement
```

## Installation

```bash
npm install @elizaos/plugin-a2a
# or
pnpm add @elizaos/plugin-a2a
```

## Quick Start

```typescript
import { AgentRuntime } from "@elizaos/core";
import { a2aPlugin } from "@elizaos/plugin-a2a";

const runtime = new AgentRuntime({
    // ... other configuration
    plugins: [a2aPlugin],
});

await runtime.initialize();
```

## Configuration

Set these environment variables or runtime settings:

```env
# Required for on-chain operations
EVM_PRIVATE_KEY=0x...your_private_key

# A2A Service Configuration
A2A_PORT=3001
A2A_HOST=0.0.0.0
A2A_BASE_URL=https://your-agent.example.com

# Optional: ERC-8004 Registry Address (default uses placeholder)
A2A_IDENTITY_REGISTRY_ADDRESS=0x...

# Optional: Chain selection (mainnet, sepolia, base)
A2A_CHAIN=mainnet

# Optional: RPC URL
EVM_PROVIDER_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
```

## Actions

### REGISTER_IDENTITY

Registers the agent on the ERC-8004 Identity Registry:

```
User: "Register my agent on the blockchain"
Agent: [Executes REGISTER_IDENTITY action]
       -> Builds Agent Card JSON
       -> Uploads to IPFS
       -> Mints ERC-8004 NFT
       -> Returns token ID and transaction hash
```

### SEND_A2A_MESSAGE

Sends messages to other agents via A2A protocol:

```
User: "Send a task request to the agent at http://other-agent.com:3001"
Agent: [Executes SEND_A2A_MESSAGE action]
       -> Discovers target agent's capabilities
       -> Sends structured A2A message
       -> Returns response
```

### QUERY_AGENT

Discovers another agent's capabilities:

```
User: "Check what the agent at localhost:3001 can do"
Agent: [Executes QUERY_AGENT action]
       -> Fetches Agent Card from /.well-known/agent-card
       -> Returns capabilities, pricing, and metadata
```

## A2A Service Endpoints

When the plugin is active, these HTTP endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/.well-known/agent-card` | GET | Agent Card (A2A spec) |
| `/agent-card` | GET | Agent Card (alternative) |
| `/a2a/message` | POST | Receive A2A messages |
| `/a2a` | POST | Receive A2A messages (alt) |
| `/a2a/capabilities` | GET | List agent capabilities |

## Agent Card Schema

The Agent Card follows the A2A specification:

```typescript
interface AgentCard {
    version: "1.0";
    agentId: UUID;
    name: string;
    description: string;
    capabilities: string[];       // Action names
    skills: string[];             // Specializations
    endpoint: string;             // A2A endpoint URL
    walletAddress: Address;       // EVM wallet
    pricing?: {
        model: "per_request" | "per_token" | "subscription" | "custom";
        currency: string;
        basePrice?: string;
        acceptedCurrencies: string[];
        btcPaymentAddress?: string;  // For Stacks/BTC settlement
        supportsLightning?: boolean;
    };
    metadata: {
        modelProvider?: string;
        character?: string;
        plugins?: string[];
        reputationScore?: number;
        completedJobs?: number;
    };
}
```

## A2A Message Format

```typescript
interface A2AMessage {
    id: string;
    from: UUID | Address;
    to: UUID | Address;
    type: "request" | "response" | "query" | "negotiate" | "validate" | "payment" | "error";
    payload: {
        action?: string;
        input?: unknown;
        output?: unknown;
        error?: { code: string; message: string };
    };
    timestamp: number;
    signature?: string;
    correlationId?: string;
}
```

## Integration Example

### Character Configuration

```typescript
const character = {
    name: "ImageOptimizer",
    bio: "I optimize images for NFTs and web applications",
    settings: {
        secrets: {
            EVM_PRIVATE_KEY: "0x...",
        },
    },
    plugins: ["@elizaos/plugin-a2a"],
};
```

### Sending Requests to Your Agent

Using curl:

```bash
# Get Agent Card
curl http://localhost:3001/.well-known/agent-card

# Send A2A Request
curl -X POST http://localhost:3001/a2a/message \
  -H "Content-Type: application/json" \
  -d '{
    "id": "msg-123",
    "from": "requester-agent-id",
    "to": "your-agent-id",
    "type": "request",
    "payload": {
      "action": "OPTIMIZE_IMAGE",
      "input": {
        "imageUrl": "https://example.com/image.png",
        "targetSize": "1MB"
      }
    },
    "timestamp": 1704067200000
  }'
```

### Postman Testing

1. Create a new POST request to `http://localhost:3001/a2a/message`
2. Set Content-Type header to `application/json`
3. Use the JSON body format above
4. Check that Eliza responds with structured JSON (not chatty text)

## Bitcoin/Stacks Settlement

For high-value agent tasks that should settle in BTC:

1. Configure your Agent Card with a Stacks payment address:

```typescript
const agentCard = {
    // ...
    pricing: {
        model: "per_request",
        currency: "USDC",
        basePrice: "10.00",
        acceptedCurrencies: ["ETH", "USDC", "sBTC", "WBTC"],
        btcPaymentAddress: "SP2EXAMPLE...",  // Stacks address
        supportsLightning: true,
    },
};
```

2. Use Ethereum for identity/reputation (ERC-8004 registry)
3. Accept sBTC or process Lightning payments for settlement
4. Post validation proofs to Ethereum for reputation

## Contract ABIs

The plugin includes ABIs for:

- **ERC-8004 Identity Registry**: Mint, burn, and manage agent identity NFTs
- **Validation Registry**: Submit and verify work proofs

## Providers

The plugin includes context providers:

- **agentCapabilitiesProvider**: Injects capabilities into conversation context
- **agentIdentityProvider**: Injects on-chain identity information
- **agentPricingProvider**: Injects pricing for negotiations

## License

MIT

## Contributing

Contributions are welcome! Please see the main ElizaOS repository for guidelines.
