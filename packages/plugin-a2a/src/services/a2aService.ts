import express, { Express, Request, Response, NextFunction } from "express";
import {
    Service,
    ServiceType,
    elizaLogger,
    composeContext,
    generateMessageResponse,
    ModelClass,
    stringToUuid,
    type IAgentRuntime,
    type Memory,
    type Content,
} from "@elizaos/core";
import {
    type A2AMessage,
    type A2AResponse,
    type A2APluginConfig,
    type AgentCard,
} from "../types";
import { a2aMessageTemplate } from "../templates";
import { buildAgentCard } from "../actions/registerIdentity";
import { privateKeyToAccount } from "viem/accounts";
import type { Address } from "viem";

/**
 * Custom ServiceType for A2A (not in core enum, so we use string)
 */
const A2A_SERVICE_TYPE = "a2a" as ServiceType;

/**
 * A2A Service Interface
 */
export interface IA2AService {
    getAgentCard(): AgentCard | null;
    sendMessage(to: string, message: A2AMessage): Promise<A2AResponse>;
    getEndpoint(): string;
    isRunning(): boolean;
}

/**
 * A2A Service
 * Provides HTTP endpoints for agent-to-agent communication following the A2A protocol
 */
export class A2AService extends Service implements IA2AService {
    static serviceType: ServiceType = A2A_SERVICE_TYPE;

    private app: Express | null = null;
    private server: ReturnType<Express["listen"]> | null = null;
    private runtime: IAgentRuntime | null = null;
    private config: A2APluginConfig = {};
    private agentCard: AgentCard | null = null;
    private running: boolean = false;

    constructor() {
        super();
    }

    get serviceType(): ServiceType {
        return A2A_SERVICE_TYPE;
    }

    /**
     * Initialize the A2A service
     */
    async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;

        // Load configuration from runtime settings
        this.config = {
            port: parseInt(runtime.getSetting("A2A_PORT") || "3001"),
            host: runtime.getSetting("A2A_HOST") || "0.0.0.0",
            baseUrl: runtime.getSetting("A2A_BASE_URL") || undefined,
            identityRegistryAddress: runtime.getSetting(
                "A2A_IDENTITY_REGISTRY_ADDRESS"
            ) as Address | undefined,
            validationRegistryAddress: runtime.getSetting(
                "A2A_VALIDATION_REGISTRY_ADDRESS"
            ) as Address | undefined,
            chain: runtime.getSetting("A2A_CHAIN") || "mainnet",
            enableSigning:
                runtime.getSetting("A2A_ENABLE_SIGNING") === "true",
            enableValidation:
                runtime.getSetting("A2A_ENABLE_VALIDATION") === "true",
            maxRequestSize: parseInt(
                runtime.getSetting("A2A_MAX_REQUEST_SIZE") || "1048576"
            ),
            requestTimeout: parseInt(
                runtime.getSetting("A2A_REQUEST_TIMEOUT") || "30000"
            ),
        };

        // Build the agent card
        await this.buildInitialAgentCard();

        // Set up Express server
        await this.setupServer();

        elizaLogger.success(
            `A2A Service initialized for agent ${runtime.character.name}`
        );
    }

    /**
     * Build the initial Agent Card from runtime configuration
     */
    private async buildInitialAgentCard(): Promise<void> {
        if (!this.runtime) return;

        const privateKey = this.runtime.getSetting("EVM_PRIVATE_KEY") as
            | `0x${string}`
            | undefined;

        let walletAddress: Address = "0x0000000000000000000000000000000000000000";
        if (privateKey) {
            const account = privateKeyToAccount(privateKey);
            walletAddress = account.address;
        }

        const baseUrl =
            this.config.baseUrl ||
            `http://${this.config.host}:${this.config.port}`;

        this.agentCard = buildAgentCard(this.runtime, {
            description:
                this.runtime.character.bio?.toString() ||
                `AI agent powered by ElizaOS`,
            skills: [],
            endpoint: `${baseUrl}/a2a`,
            walletAddress,
        });
    }

    /**
     * Set up the Express HTTP server with A2A endpoints
     */
    private async setupServer(): Promise<void> {
        this.app = express();

        // Middleware
        this.app.use(express.json({ limit: this.config.maxRequestSize }));

        // Error handling middleware
        this.app.use(
            (err: Error, _req: Request, res: Response, _next: NextFunction) => {
                elizaLogger.error("A2A Service error:", err);
                res.status(500).json({
                    success: false,
                    error: {
                        code: "INTERNAL_ERROR",
                        message: "Internal server error",
                    },
                });
            }
        );

        // Health check endpoint
        this.app.get("/health", (_req, res) => {
            res.json({
                status: "healthy",
                agentId: this.runtime?.agentId,
                agentName: this.runtime?.character.name,
            });
        });

        // Agent Card endpoint (GET /.well-known/agent-card)
        this.app.get("/.well-known/agent-card", (_req, res) => {
            if (!this.agentCard) {
                res.status(503).json({
                    error: "Agent card not yet initialized",
                });
                return;
            }
            res.json(this.agentCard);
        });

        // Agent Card endpoint (alternative path)
        this.app.get("/agent-card", (_req, res) => {
            if (!this.agentCard) {
                res.status(503).json({
                    error: "Agent card not yet initialized",
                });
                return;
            }
            res.json(this.agentCard);
        });

        // Main A2A message endpoint
        this.app.post("/a2a/message", async (req, res) => {
            await this.handleA2AMessage(req, res);
        });

        // Alternative endpoint path
        this.app.post("/a2a", async (req, res) => {
            await this.handleA2AMessage(req, res);
        });

        // Capabilities query endpoint
        this.app.get("/a2a/capabilities", (_req, res) => {
            if (!this.runtime) {
                res.status(503).json({ error: "Service not initialized" });
                return;
            }

            const capabilities = this.runtime.actions.map((action) => ({
                name: action.name,
                description: action.description,
                similes: action.similes,
            }));

            res.json({
                agentId: this.runtime.agentId,
                name: this.runtime.character.name,
                capabilities,
            });
        });

        // Start the server
        const port = this.config.port || 3001;
        const host = this.config.host || "0.0.0.0";

        this.server = this.app.listen(port, host, () => {
            this.running = true;
            elizaLogger.success(
                `A2A Service listening on http://${host}:${port}`
            );
            elizaLogger.info(
                `Agent Card available at http://${host}:${port}/.well-known/agent-card`
            );
            elizaLogger.info(
                `A2A endpoint available at http://${host}:${port}/a2a/message`
            );
        });
    }

    /**
     * Handle incoming A2A protocol messages
     */
    private async handleA2AMessage(req: Request, res: Response): Promise<void> {
        if (!this.runtime) {
            res.status(503).json({
                success: false,
                error: {
                    code: "SERVICE_UNAVAILABLE",
                    message: "A2A service not initialized",
                },
            });
            return;
        }

        try {
            const message = req.body as A2AMessage;

            // Validate message structure
            if (!message.type || !message.from) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "INVALID_MESSAGE",
                        message:
                            "Missing required fields: type, from",
                    },
                });
                return;
            }

            elizaLogger.info("Received A2A message", {
                type: message.type,
                from: message.from,
                correlationId: message.correlationId,
            });

            // Create a unique room ID for this A2A interaction
            const roomId = stringToUuid(
                `a2a-${message.from}-${this.runtime.agentId}`
            );
            const userId = stringToUuid(`agent-${message.from}`);

            // Ensure connection
            await this.runtime.ensureConnection(
                userId,
                roomId,
                `Agent-${message.from}`,
                "A2A Agent",
                "a2a"
            );

            // Process based on message type
            const response = await this.processA2AMessage(
                message,
                roomId,
                userId
            );

            res.json(response);
        } catch (error) {
            elizaLogger.error("Error processing A2A message:", error);
            res.status(500).json({
                success: false,
                error: {
                    code: "PROCESSING_ERROR",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                },
            });
        }
    }

    /**
     * Process an A2A message and generate a response
     */
    private async processA2AMessage(
        message: A2AMessage,
        roomId: ReturnType<typeof stringToUuid>,
        userId: ReturnType<typeof stringToUuid>
    ): Promise<A2AResponse> {
        if (!this.runtime) {
            return {
                success: false,
                error: {
                    code: "NOT_INITIALIZED",
                    message: "Runtime not initialized",
                },
            };
        }

        const startTime = Date.now();

        // Create memory for the incoming message
        const content: Content = {
            text: JSON.stringify(message.payload),
            source: "a2a",
            action: message.payload?.action,
        };

        const memory: Memory = {
            id: stringToUuid(message.id || `${Date.now()}-${message.from}`),
            userId,
            agentId: this.runtime.agentId,
            roomId,
            content,
            createdAt: message.timestamp || Date.now(),
        };

        // Add embedding and save memory
        await this.runtime.messageManager.addEmbeddingToMemory(memory);
        await this.runtime.messageManager.createMemory(memory);

        // Compose state with A2A context
        const state = await this.runtime.composeState(memory, {
            fromAgent: message.from,
            messageType: message.type,
            correlationId: message.correlationId || "",
            payload: JSON.stringify(message.payload),
            capabilities: this.runtime.actions
                .map((a) => `${a.name}: ${a.description}`)
                .join("\n"),
        });

        // Generate response using the A2A template
        const context = composeContext({
            state,
            template: a2aMessageTemplate,
        });

        const responseContent = await generateMessageResponse({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        // Process any actions if the response indicates one
        if (responseContent.action) {
            const responseMemory: Memory = {
                id: stringToUuid(`response-${Date.now()}`),
                userId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                roomId,
                content: responseContent,
                createdAt: Date.now(),
            };

            await this.runtime.processActions(memory, [responseMemory], state);
        }

        // Build the A2A response
        const processingTimeMs = Date.now() - startTime;

        return {
            success: true,
            data: responseContent,
            correlationId: message.correlationId,
            metadata: {
                processingTimeMs,
            },
        };
    }

    /**
     * Send an A2A message to another agent
     */
    async sendMessage(
        toEndpoint: string,
        message: A2AMessage
    ): Promise<A2AResponse> {
        if (!this.runtime) {
            return {
                success: false,
                error: {
                    code: "NOT_INITIALIZED",
                    message: "Service not initialized",
                },
            };
        }

        try {
            // Add our agent ID as the sender
            message.from = this.runtime.agentId;
            message.timestamp = Date.now();

            const response = await fetch(`${toEndpoint}/a2a/message`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(message),
                signal: AbortSignal.timeout(this.config.requestTimeout || 30000),
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            return (await response.json()) as A2AResponse;
        } catch (error) {
            elizaLogger.error("Error sending A2A message:", error);
            return {
                success: false,
                error: {
                    code: "SEND_ERROR",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Failed to send message",
                },
            };
        }
    }

    /**
     * Get the current Agent Card
     */
    getAgentCard(): AgentCard | null {
        return this.agentCard;
    }

    /**
     * Get the A2A endpoint URL
     */
    getEndpoint(): string {
        const baseUrl =
            this.config.baseUrl ||
            `http://${this.config.host}:${this.config.port}`;
        return `${baseUrl}/a2a`;
    }

    /**
     * Check if the service is running
     */
    isRunning(): boolean {
        return this.running;
    }

    /**
     * Shutdown the service
     */
    async shutdown(): Promise<void> {
        if (this.server) {
            this.server.close();
            this.running = false;
            elizaLogger.info("A2A Service shut down");
        }
    }
}

/**
 * Create a new A2A Service instance
 */
export function createA2AService(): A2AService {
    return new A2AService();
}
