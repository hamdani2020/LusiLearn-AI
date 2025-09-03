# NVIDIA GPT-OSS Setup Guide

## Overview
The AI service now uses NVIDIA's GPT-OSS model as the default AI provider. This provides high-quality AI responses with reasoning capabilities.

## Configuration

### Environment Variables
Add these to your `.env` file:

```bash
# AI Provider (default: nvidia)
AI_PROVIDER=nvidia

# NVIDIA Configuration (GPT-OSS)
NVIDIA_API_KEY=your-nvidia-api-key-here
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=gpt-oss
NVIDIA_MAX_TOKENS=1000
NVIDIA_TEMPERATURE=0.7
NVIDIA_TOP_P=0.9
NVIDIA_TIMEOUT=30
NVIDIA_MAX_RETRIES=3
```

### API Key Setup
1. Visit [NVIDIA API](https://integrate.api.nvidia.com/)
2. Sign up for an account
3. Generate an API key
4. Add the API key to your `.env` file

## Features

### GPT-OSS Model
- **Model**: `gpt-oss` (Open Source)
- **Base URL**: `https://integrate.api.nvidia.com/v1`
- **Reasoning**: Supports `reasoning_content` for enhanced responses
- **Performance**: Optimized for educational content generation

### AI Service Integration
The NVIDIA service provides:
- **Learning Path Generation**: Personalized educational paths
- **Content Recommendations**: AI-curated learning materials
- **Peer Matching**: Intelligent study partner suggestions
- **Caching**: Redis-based response caching
- **Rate Limiting**: Built-in API rate limit management

## Fallback Configuration

The system automatically falls back to other providers if NVIDIA is unavailable:
1. **NVIDIA** (Primary)
2. **OpenAI** (Fallback 1)
3. **Gemini** (Fallback 2)
4. **Algorithmic** (Final fallback)

## Usage Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key="your-nvidia-api-key"
)

completion = client.chat.completions.create(
    model="gpt-oss",
    messages=[{"role": "user", "content": "Hello"}],
    temperature=0.7,
    top_p=0.9,
    max_tokens=1000,
    stream=False
)

# Extract reasoning content if available
reasoning = getattr(completion.choices[0].message, "reasoning_content", None)
if reasoning:
    print(f"Reasoning: {reasoning}")

print(f"Response: {completion.choices[0].message.content}")
```

## Health Monitoring

The health service automatically checks NVIDIA API connectivity:
- **Primary Check**: NVIDIA API health
- **Fallback Checks**: OpenAI and Gemini if NVIDIA fails
- **Status Reporting**: Real-time provider status

## Troubleshooting

### Common Issues
1. **Invalid API Key**: Ensure your NVIDIA API key is correct
2. **Rate Limits**: The service includes automatic rate limiting
3. **Connection Issues**: Check network connectivity to NVIDIA API

### Logs
Monitor the AI service logs for:
- NVIDIA service initialization
- API connection tests
- Fallback provider usage

## Performance

- **Response Time**: Typically 1-3 seconds
- **Token Limit**: Configurable up to 1000 tokens
- **Caching**: Redis-based response caching for improved performance
- **Concurrent Requests**: Built-in rate limiting and connection pooling 