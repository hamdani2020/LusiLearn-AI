import { ElasticsearchService } from '../elasticsearch.service';
import { Client } from '@elastic/elasticsearch';
import { 
  ContentItem, 
  ContentSource, 
  ContentFormat, 
  DifficultyLevel, 
  AgeRating 
} from '@lusilearn/shared-types';

// Mock Elasticsearch client
jest.mock('@elastic/elasticsearch');
jest.mock('../../utils/logger');

const MockedClient = Client as jest.MockedClass<typeof Client>;

describe('ElasticsearchService', () => {
  let elasticsearchService: ElasticsearchService;
  let mockClient: jest.Mocked<Client>;

  const mockContentItem: ContentItem = {
    id: 'test-content-id',
    source: ContentSource.YOUTUBE,
    externalId: 'test-video-id',
    url: 'https://youtube.com/watch?v=test-video-id',
    title: 'Learn JavaScript Programming',
    description: 'A comprehensive tutorial on JavaScript programming for beginners',
    thumbnailUrl: 'https://img.youtube.com/vi/test-video-id/hqdefault.jpg',
    metadata: {
      duration: 1200,
      difficulty: DifficultyLevel.BEGINNER,
      subject: 'programming',
      topics: ['javascript', 'programming', 'tutorial'],
      format: ContentFormat.VIDEO,
      language: 'en',
      learningObjectives: ['Learn JavaScript basics', 'Understand variables and functions']
    },
    qualityMetrics: {
      userRating: 4.5,
      completionRate: 85,
      effectivenessScore: 90,
      reportCount: 0,
      lastUpdated: new Date()
    },
    ageRating: AgeRating.ALL_AGES,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    // Create mock client instance
    mockClient = {
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
        refresh: jest.fn()
      },
      index: jest.fn(),
      bulk: jest.fn(),
      search: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    // Mock the Client constructor to return our mock
    MockedClient.mockImplementation(() => mockClient);

    // Clear mocks before creating service
    jest.clearAllMocks();
    
    elasticsearchService = new ElasticsearchService();
  });

  describe('initialization', () => {
    it('should initialize and create index if it does not exist', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({} as any);

      await elasticsearchService.initializeIndex();

      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: 'lusilearn-content'
      });
      expect(mockClient.indices.create).toHaveBeenCalled();
    });

    it('should not create index if it already exists', async () => {
      mockClient.indices.exists.mockResolvedValue(true);

      await elasticsearchService.initializeIndex();

      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: 'lusilearn-content'
      });
      expect(mockClient.indices.create).not.toHaveBeenCalled();
    });
  });

  describe('indexContent', () => {
    it('should index content successfully', async () => {
      mockClient.index.mockResolvedValue({} as any);

      await elasticsearchService.indexContent(mockContentItem);

      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'lusilearn-content',
        id: mockContentItem.id,
        body: expect.objectContaining({
          ...mockContentItem,
          searchText: expect.stringContaining('Learn JavaScript Programming'),
          popularityScore: expect.any(Number)
        })
      });
    });

    it('should handle indexing errors', async () => {
      mockClient.index.mockRejectedValue(new Error('Indexing failed'));

      await expect(elasticsearchService.indexContent(mockContentItem))
        .rejects.toThrow('Indexing failed');
    });
  });

  describe('bulkIndexContent', () => {
    it('should bulk index content successfully', async () => {
      const contentItems = [mockContentItem];
      mockClient.bulk.mockResolvedValue({ errors: false, items: [] } as any);

      await elasticsearchService.bulkIndexContent(contentItems);

      expect(mockClient.bulk).toHaveBeenCalledWith({
        body: expect.arrayContaining([
          { index: { _index: 'lusilearn-content', _id: mockContentItem.id } },
          expect.objectContaining({
            ...mockContentItem,
            searchText: expect.stringContaining('Learn JavaScript Programming'),
            popularityScore: expect.any(Number)
          })
        ])
      });
    });

    it('should handle bulk indexing with errors', async () => {
      const contentItems = [mockContentItem];
      mockClient.bulk.mockResolvedValue({ 
        errors: true, 
        items: [{ index: { error: 'Some error' } }] 
      } as any);

      // Should not throw error, but log it
      await expect(elasticsearchService.bulkIndexContent(contentItems))
        .resolves.not.toThrow();
    });
  });

  describe('searchContent', () => {
    it('should search content with text query', async () => {
      const searchQuery = {
        query: 'javascript tutorial',
        page: 1,
        size: 10
      };

      const mockSearchResponse = {
        hits: {
          hits: [
            {
              _source: mockContentItem,
              _score: 1.5,
              highlight: { title: ['<em>JavaScript</em> Programming'] }
            }
          ],
          total: { value: 1 }
        }
      };

      mockClient.search.mockResolvedValue(mockSearchResponse as any);

      const result = await elasticsearchService.searchContent(searchQuery);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual(expect.objectContaining({
        ...mockContentItem,
        _score: 1.5,
        _highlights: { title: ['<em>JavaScript</em> Programming'] }
      }));

      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'lusilearn-content',
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: expect.arrayContaining([
                expect.objectContaining({
                  multi_match: expect.objectContaining({
                    query: 'javascript tutorial'
                  })
                })
              ])
            })
          })
        })
      });
    });

    it('should search content with filters', async () => {
      const searchQuery = {
        query: 'programming',
        filters: {
          subject: 'programming',
          difficulty: DifficultyLevel.BEGINNER,
          format: ContentFormat.VIDEO
        },
        page: 1,
        size: 10
      };

      const mockSearchResponse = {
        hits: {
          hits: [{ _source: mockContentItem, _score: 1.0 }],
          total: { value: 1 }
        }
      };

      mockClient.search.mockResolvedValue(mockSearchResponse as any);

      const result = await elasticsearchService.searchContent(searchQuery);

      expect(result.items).toHaveLength(1);
      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'lusilearn-content',
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([
                { term: { isActive: true } },
                { term: { 'metadata.subject': 'programming' } },
                { term: { 'metadata.difficulty': 'beginner' } },
                { term: { 'metadata.format': 'video' } }
              ])
            })
          })
        })
      });
    });

    it('should include aggregations when requested', async () => {
      const searchQuery = {
        query: 'programming',
        includeAggregations: true,
        page: 1,
        size: 10
      };

      const mockSearchResponse = {
        hits: {
          hits: [{ _source: mockContentItem, _score: 1.0 }],
          total: { value: 1 }
        },
        aggregations: {
          subjects: {
            buckets: [
              { key: 'programming', doc_count: 5 },
              { key: 'mathematics', doc_count: 3 }
            ]
          },
          difficulties: {
            buckets: [
              { key: 'beginner', doc_count: 4 },
              { key: 'intermediate', doc_count: 2 }
            ]
          }
        }
      };

      mockClient.search.mockResolvedValue(mockSearchResponse as any);

      const result = await elasticsearchService.searchContent(searchQuery);

      expect(result.aggregations).toBeDefined();
      expect(result.aggregations!.subjects).toEqual({
        'programming': 5,
        'mathematics': 3
      });
      expect(result.aggregations!.difficulties).toEqual({
        'beginner': 4,
        'intermediate': 2
      });
    });

    it('should handle search errors', async () => {
      const searchQuery = {
        query: 'test',
        page: 1,
        size: 10
      };

      mockClient.search.mockRejectedValue(new Error('Search failed'));

      await expect(elasticsearchService.searchContent(searchQuery))
        .rejects.toThrow('Search failed');
    });
  });

  describe('getSuggestions', () => {
    it('should get search suggestions', async () => {
      const mockSuggestResponse = {
        suggest: {
          title_suggest: [{
            options: [
              { text: 'JavaScript Programming' },
              { text: 'JavaScript Tutorial' },
              { text: 'JavaScript Basics' }
            ]
          }]
        }
      };

      mockClient.search.mockResolvedValue(mockSuggestResponse as any);

      const suggestions = await elasticsearchService.getSuggestions('java', 3);

      expect(suggestions).toEqual([
        'JavaScript Programming',
        'JavaScript Tutorial',
        'JavaScript Basics'
      ]);

      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'lusilearn-content',
        body: {
          suggest: {
            title_suggest: {
              prefix: 'java',
              completion: {
                field: 'title.suggest',
                size: 3
              }
            }
          }
        }
      });
    });

    it('should handle suggestion errors gracefully', async () => {
      mockClient.search.mockRejectedValue(new Error('Suggestion failed'));

      const suggestions = await elasticsearchService.getSuggestions('java');

      expect(suggestions).toEqual([]);
    });
  });

  describe('getRelatedContent', () => {
    it('should get related content using More Like This', async () => {
      const contentId = 'test-content-id';

      mockClient.get.mockResolvedValue({
        found: true,
        _source: mockContentItem
      } as any);

      const mockRelatedResponse = {
        hits: {
          hits: [
            { _source: { ...mockContentItem, id: 'related-1', title: 'Advanced JavaScript' } },
            { _source: { ...mockContentItem, id: 'related-2', title: 'JavaScript ES6' } }
          ]
        }
      };

      mockClient.search.mockResolvedValue(mockRelatedResponse as any);

      const relatedContent = await elasticsearchService.getRelatedContent(contentId, 2);

      expect(relatedContent).toHaveLength(2);
      expect(relatedContent[0].title).toBe('Advanced JavaScript');
      expect(relatedContent[1].title).toBe('JavaScript ES6');

      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'lusilearn-content',
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: expect.arrayContaining([
                expect.objectContaining({
                  more_like_this: expect.objectContaining({
                    like: [{ _index: 'lusilearn-content', _id: contentId }]
                  })
                })
              ]),
              must_not: [{ term: { _id: contentId } }]
            })
          })
        })
      });
    });

    it('should return empty array if content not found', async () => {
      mockClient.get.mockResolvedValue({ found: false } as any);

      const relatedContent = await elasticsearchService.getRelatedContent('non-existent', 5);

      expect(relatedContent).toEqual([]);
    });

    it('should handle related content errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('Get failed'));

      const relatedContent = await elasticsearchService.getRelatedContent('test-id', 5);

      expect(relatedContent).toEqual([]);
    });
  });

  describe('updateContent', () => {
    it('should update content in index', async () => {
      const contentId = 'test-content-id';
      const updates = { title: 'Updated Title' };

      mockClient.get.mockResolvedValue({
        found: true,
        _source: mockContentItem
      } as any);

      mockClient.update.mockResolvedValue({} as any);

      await elasticsearchService.updateContent(contentId, updates);

      expect(mockClient.update).toHaveBeenCalledWith({
        index: 'lusilearn-content',
        id: contentId,
        body: {
          doc: expect.objectContaining({
            title: 'Updated Title',
            searchText: expect.stringContaining('Updated Title'),
            popularityScore: expect.any(Number)
          })
        }
      });
    });

    it('should handle update errors', async () => {
      mockClient.get.mockResolvedValue({
        found: true,
        _source: mockContentItem
      } as any);
      mockClient.update.mockRejectedValue(new Error('Update failed'));

      await expect(elasticsearchService.updateContent('test-id', { title: 'New Title' }))
        .rejects.toThrow('Update failed');
    });
  });

  describe('deleteContent', () => {
    it('should delete content from index', async () => {
      const contentId = 'test-content-id';
      mockClient.delete.mockResolvedValue({} as any);

      await elasticsearchService.deleteContent(contentId);

      expect(mockClient.delete).toHaveBeenCalledWith({
        index: 'lusilearn-content',
        id: contentId
      });
    });

    it('should handle delete errors', async () => {
      mockClient.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(elasticsearchService.deleteContent('test-id'))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('refreshIndex', () => {
    it('should refresh the index', async () => {
      mockClient.indices.refresh.mockResolvedValue({} as any);

      await elasticsearchService.refreshIndex();

      expect(mockClient.indices.refresh).toHaveBeenCalledWith({
        index: 'lusilearn-content'
      });
    });

    it('should handle refresh errors', async () => {
      mockClient.indices.refresh.mockRejectedValue(new Error('Refresh failed'));

      await expect(elasticsearchService.refreshIndex())
        .rejects.toThrow('Refresh failed');
    });
  });
});