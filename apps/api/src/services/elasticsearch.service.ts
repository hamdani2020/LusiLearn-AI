import { Client } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';
import {
  ContentItem,
  ContentQuery,
  DifficultyLevel,
  ContentFormat,
  AgeRating
} from '@lusilearn/shared-types';

export interface SearchResult {
  items: ContentItem[];
  total: number;
  aggregations?: {
    subjects: { [key: string]: number };
    difficulties: { [key: string]: number };
    formats: { [key: string]: number };
    sources: { [key: string]: number };
  };
}

export interface ContentSearchQuery {
  query: string;
  filters?: {
    subject?: string;
    difficulty?: DifficultyLevel;
    format?: ContentFormat;
    ageRating?: AgeRating;
    source?: string;
    duration?: { min?: number; max?: number };
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  page?: number;
  size?: number;
  includeAggregations?: boolean;
}

export class ElasticsearchService {
  private client: Client;
  private indexName = 'lusilearn-content';

  constructor() {
    const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

    this.client = new Client({
      node: elasticsearchUrl,
      requestTimeout: 30000,
      pingTimeout: 3000,
      sniffOnStart: false
    });

    // Initialize index asynchronously (don't await in constructor)
    this.initializeIndex().catch(error => {
      logger.error('Failed to initialize Elasticsearch index:', error);
    });
  }

  async initializeIndex(): Promise<void> {
    try {
      // Check if index exists
      const indexExists = await this.client.indices.exists({
        index: this.indexName
      });

      if (!indexExists) {
        await this.createIndex();
      }
    } catch (error) {
      logger.error('Error initializing Elasticsearch index:', error);
    }
  }

  async createIndex(): Promise<void> {
    try {
      await this.client.indices.create({
        index: this.indexName,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              content_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: [
                  'lowercase',
                  'stop',
                  'stemmer',
                  'synonym_filter'
                ]
              }
            },
            filter: {
              synonym_filter: {
                type: 'synonym',
                synonyms: [
                  'js,javascript',
                  'programming,coding,development',
                  'math,mathematics',
                  'ai,artificial intelligence,machine learning',
                  'web development,frontend,backend'
                ]
              }
            }
          }
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            source: { type: 'keyword' },
            externalId: { type: 'keyword' },
            url: { type: 'keyword', index: false },
            title: {
              type: 'text',
              analyzer: 'content_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            description: {
              type: 'text',
              analyzer: 'content_analyzer'
            },
            thumbnailUrl: { type: 'keyword', index: false },
            metadata: {
              properties: {
                duration: { type: 'integer' },
                difficulty: { type: 'keyword' },
                subject: { type: 'keyword' },
                topics: { type: 'keyword' },
                format: { type: 'keyword' },
                language: { type: 'keyword' },
                prerequisites: { type: 'keyword' },
                learningObjectives: {
                  type: 'text',
                  analyzer: 'content_analyzer'
                }
              }
            },
            qualityMetrics: {
              properties: {
                userRating: { type: 'float' },
                completionRate: { type: 'float' },
                effectivenessScore: { type: 'float' },
                reportCount: { type: 'integer' },
                lastUpdated: { type: 'date' }
              }
            },
            ageRating: { type: 'keyword' },
            embeddings: { type: 'dense_vector', dims: 1536 },
            isActive: { type: 'boolean' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            // Computed fields for better search
            searchText: {
              type: 'text',
              analyzer: 'content_analyzer'
            },
            popularityScore: { type: 'float' }
          }
        }
      });

      logger.info('Elasticsearch index created successfully');
    } catch (error) {
      logger.error('Error creating Elasticsearch index:', error);
      throw error;
    }
  }

  async indexContent(content: ContentItem): Promise<void> {
    try {
      // Prepare document for indexing
      const document = {
        ...content,
        searchText: `${content.title} ${content.description} ${content.metadata.topics.join(' ')} ${content.metadata.learningObjectives.join(' ')}`,
        popularityScore: this.calculatePopularityScore(content)
      };

      await this.client.index({
        index: this.indexName,
        id: content.id,
        document: document
      });

      logger.debug('Content indexed successfully:', { contentId: content.id });
    } catch (error) {
      logger.error('Error indexing content:', error);
      throw error;
    }
  }

  async bulkIndexContent(contentItems: ContentItem[]): Promise<void> {
    try {
      const body = contentItems.flatMap(content => [
        { index: { _index: this.indexName, _id: content.id } },
        {
          ...content,
          searchText: `${content.title} ${content.description} ${content.metadata.topics.join(' ')} ${content.metadata.learningObjectives.join(' ')}`,
          popularityScore: this.calculatePopularityScore(content)
        }
      ]);

      const response = await this.client.bulk({ operations: body });

      if (response.errors) {
        logger.error('Bulk indexing had errors:', response.items);
      } else {
        logger.info('Bulk content indexed successfully:', { count: contentItems.length });
      }
    } catch (error) {
      logger.error('Error bulk indexing content:', error);
      throw error;
    }
  }

  async searchContent(searchQuery: ContentSearchQuery): Promise<SearchResult> {
    try {
      const { query, filters, sort, page = 1, size = 20, includeAggregations = false } = searchQuery;

      // Build Elasticsearch query
      const esQuery: any = {
        bool: {
          must: [],
          filter: [
            { term: { isActive: true } }
          ]
        }
      };

      // Add text search
      if (query && query.trim()) {
        esQuery.bool.must.push({
          multi_match: {
            query: query.trim(),
            fields: [
              'title^3',
              'description^2',
              'metadata.learningObjectives^2',
              'metadata.topics^1.5',
              'searchText'
            ],
            type: 'best_fields',
            fuzziness: 'AUTO',
            operator: 'or'
          }
        });
      } else {
        esQuery.bool.must.push({ match_all: {} });
      }

      // Add filters
      if (filters) {
        if (filters.subject) {
          esQuery.bool.filter.push({ term: { 'metadata.subject': filters.subject } });
        }
        if (filters.difficulty) {
          esQuery.bool.filter.push({ term: { 'metadata.difficulty': filters.difficulty } });
        }
        if (filters.format) {
          esQuery.bool.filter.push({ term: { 'metadata.format': filters.format } });
        }
        if (filters.ageRating) {
          esQuery.bool.filter.push({ term: { ageRating: filters.ageRating } });
        }
        if (filters.source) {
          esQuery.bool.filter.push({ term: { source: filters.source } });
        }
        if (filters.duration) {
          const durationFilter: any = {};
          if (filters.duration.min !== undefined) {
            durationFilter.gte = filters.duration.min;
          }
          if (filters.duration.max !== undefined) {
            durationFilter.lte = filters.duration.max;
          }
          esQuery.bool.filter.push({ range: { 'metadata.duration': durationFilter } });
        }
      }

      // Build sort
      const sortOptions: any[] = [];
      if (sort) {
        sortOptions.push({ [sort.field]: { order: sort.order } });
      } else {
        // Default sort by relevance and quality
        sortOptions.push(
          { _score: { order: 'desc' } },
          { popularityScore: { order: 'desc' } },
          { 'qualityMetrics.effectivenessScore': { order: 'desc' } }
        );
      }

      // Build aggregations
      const aggregations: any = {};
      if (includeAggregations) {
        aggregations.subjects = {
          terms: { field: 'metadata.subject', size: 20 }
        };
        aggregations.difficulties = {
          terms: { field: 'metadata.difficulty', size: 10 }
        };
        aggregations.formats = {
          terms: { field: 'metadata.format', size: 10 }
        };
        aggregations.sources = {
          terms: { field: 'source', size: 10 }
        };
      }

      const searchParams: any = {
        index: this.indexName,
        query: esQuery,
        sort: sortOptions,
        from: (page - 1) * size,
        size,
        highlight: {
          fields: {
            title: {},
            description: {},
            'metadata.learningObjectives': {}
          }
        }
      };

      if (Object.keys(aggregations).length > 0) {
        searchParams.aggs = aggregations;
      }

      const response = await this.client.search(searchParams);

      // Process results
      const items: ContentItem[] = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
        _highlights: hit.highlight
      }));

      const result: SearchResult = {
        items,
        total: typeof response.hits.total === 'object' && response.hits.total !== null
          ? response.hits.total.value
          : (response.hits.total as number) || 0
      };

      // Process aggregations
      if (includeAggregations && response.aggregations) {
        result.aggregations = {
          subjects: this.processAggregation(response.aggregations.subjects),
          difficulties: this.processAggregation(response.aggregations.difficulties),
          formats: this.processAggregation(response.aggregations.formats),
          sources: this.processAggregation(response.aggregations.sources)
        };
      }

      logger.info('Content search completed:', {
        query,
        total: result.total,
        returned: items.length
      });

      return result;
    } catch (error) {
      logger.error('Error searching content:', error);
      throw error;
    }
  }

  async getSuggestions(query: string, size: number = 5): Promise<string[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        suggest: {
          title_suggest: {
            prefix: query,
            completion: {
              field: 'title.suggest',
              size
            }
          }
        }
      });

      const suggestions = Array.isArray(response.suggest?.title_suggest?.[0]?.options)
        ? (response.suggest.title_suggest[0].options as any[]).map((option: any) => option.text)
        : [];

      return suggestions;
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      return [];
    }
  }

  async getRelatedContent(contentId: string, size: number = 5): Promise<ContentItem[]> {
    try {
      // First, get the content to find similar items
      const content = await this.client.get({
        index: this.indexName,
        id: contentId
      });

      if (!content.found) {
        return [];
      }

      const sourceContent = content._source as any;

      // Search for similar content using More Like This query
      const response = await this.client.search({
        index: this.indexName,
        query: {
          bool: {
            must: [
              {
                more_like_this: {
                  fields: ['title', 'description', 'metadata.topics', 'metadata.learningObjectives'],
                  like: [
                    {
                      _index: this.indexName,
                      _id: contentId
                    }
                  ],
                  min_term_freq: 1,
                  max_query_terms: 12
                }
              }
            ],
            filter: [
              { term: { isActive: true } }
            ],
            must_not: [
              { term: { _id: contentId } }
            ]
          }
        },
        size
      });

      return response.hits.hits.map((hit: any) => hit._source);
    } catch (error) {
      logger.error('Error getting related content:', error);
      return [];
    }
  }

  async updateContent(contentId: string, updates: Partial<ContentItem>): Promise<void> {
    try {
      // Add computed fields if content is being updated
      const updateDoc: any = { ...updates };
      if (updates.title || updates.description || updates.metadata) {
        const existingContent = await this.client.get({
          index: this.indexName,
          id: contentId
        });

        if (existingContent.found) {
          const existing = existingContent._source as any;
          const merged = { ...existing, ...updates };
          updateDoc.searchText = `${merged.title} ${merged.description} ${merged.metadata.topics.join(' ')} ${merged.metadata.learningObjectives.join(' ')}`;
          updateDoc.popularityScore = this.calculatePopularityScore(merged);
        }
      }

      await this.client.update({
        index: this.indexName,
        id: contentId,
        doc: updateDoc
      });

      logger.debug('Content updated in search index:', { contentId });
    } catch (error) {
      logger.error('Error updating content in search index:', error);
      throw error;
    }
  }

  async deleteContent(contentId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: contentId
      });

      logger.debug('Content deleted from search index:', { contentId });
    } catch (error) {
      logger.error('Error deleting content from search index:', error);
      throw error;
    }
  }

  async refreshIndex(): Promise<void> {
    try {
      await this.client.indices.refresh({
        index: this.indexName
      });
    } catch (error) {
      logger.error('Error refreshing search index:', error);
      throw error;
    }
  }

  private calculatePopularityScore(content: ContentItem): number {
    const {
      userRating,
      completionRate,
      effectivenessScore,
      reportCount
    } = content.qualityMetrics;

    // Calculate popularity based on multiple factors
    let score = 0;

    // User rating factor (0-5 scale, weight: 30%)
    score += (userRating / 5) * 30;

    // Completion rate factor (0-100 scale, weight: 25%)
    score += (completionRate / 100) * 25;

    // Effectiveness score factor (0-100 scale, weight: 25%)
    score += (effectivenessScore / 100) * 25;

    // Recency factor (weight: 10%)
    const daysSinceCreated = (Date.now() - content.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 10 - (daysSinceCreated / 30)); // Decay over 30 days
    score += recencyScore;

    // Report penalty (subtract 2 points per report, max 10 points)
    score -= Math.min(reportCount * 2, 10);

    // Source reliability bonus
    const sourceBonus = {
      'khan_academy': 5,
      'coursera': 3,
      'youtube': 0,
      'github': 2,
      'internal': 4
    };
    score += sourceBonus[content.source as keyof typeof sourceBonus] || 0;

    return Math.max(0, Math.min(100, score));
  }

  private processAggregation(aggregation: any): { [key: string]: number } {
    const result: { [key: string]: number } = {};

    if (aggregation && aggregation.buckets) {
      aggregation.buckets.forEach((bucket: any) => {
        result[bucket.key] = bucket.doc_count;
      });
    }

    return result;
  }
}