export interface AppConfig {
  openaiApiKey?: string;
  modelName?: string;
  embeddingModel?: string;
  postgresUrl?: string;
  neo4jUrl?: string;
  neo4jUser?: string;
  neo4jPassword?: string;
  neo4jDatabase?: string;
  vectorDbUrl?: string;
  vectorDbApiKey?: string;
  redisUrl?: string;
  eventBrokers?: string;
  vectorDim: number;
  logLevel: "info" | "debug" | "warn" | "error";
}

export function loadConfig(env = process.env): AppConfig {
  return {
    openaiApiKey: env.OPENAI_API_KEY,
    modelName: env.MODEL_NAME || "gpt-4o-mini",
    embeddingModel: env.EMBEDDING_MODEL || env.MODEL_NAME || "text-embedding-3-small",
    postgresUrl: env.POSTGRES_URL,
    neo4jUrl: env.NEO4J_URL || env.NEO4J_URI,
    neo4jUser: env.NEO4J_USER || env.NEO4J_USERNAME,
    neo4jPassword: env.NEO4J_PASSWORD,
    neo4jDatabase: env.NEO4J_DATABASE,
    vectorDbUrl: env.VECTOR_DB_URL,
    vectorDbApiKey: env.QDRANT_API_KEY,
    redisUrl: env.REDIS_URL,
    eventBrokers: env.EVENT_BROKERS,
    vectorDim: Number(env.VECTOR_DIM || 1536),
    logLevel: (env.LOG_LEVEL as AppConfig["logLevel"]) || "info",
  };
}
