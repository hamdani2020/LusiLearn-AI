// AI service configuration utilities

export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  model: string;
}

export interface VectorDBConfig {
  provider: 'pinecone' | 'weaviate' | 'qdrant';
  apiKey: string;
  environment?: string;
  indexName: string;
  dimensions: number;
}

export const getOpenAIConfig = (): OpenAIConfig => {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    organization: process.env.OPENAI_ORGANIZATION,
    baseUrl: process.env.OPENAI_BASE_URL,
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2048'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  };
};

export const getVectorDBConfig = (): VectorDBConfig => {
  return {
    provider: (process.env.VECTOR_DB_PROVIDER as 'pinecone' | 'weaviate' | 'qdrant') || 'pinecone',
    apiKey: process.env.VECTOR_DB_API_KEY || '',
    environment: process.env.VECTOR_DB_ENVIRONMENT,
    indexName: process.env.VECTOR_DB_INDEX || 'lusilearn-content',
    dimensions: parseInt(process.env.VECTOR_DB_DIMENSIONS || '1536'),
  };
};

export const getAIServiceConfig = () => {
  return {
    openai: getOpenAIConfig(),
    vectordb: getVectorDBConfig(),
    requestTimeout: parseInt(process.env.AI_REQUEST_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3'),
    fallbackEnabled: process.env.AI_FALLBACK_ENABLED === 'true',
  };
};