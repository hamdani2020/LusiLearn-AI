'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  InfiniteScrollContainer,
  VirtualList,
  LazyImage,
  PaginationControls,
  SimplePagination
} from '@/components/pagination';
import { usePaginatedData } from '@/hooks/base/use-paginated-data';

// Mock data for examples
const generateMockItems = (count: number) => 
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Item ${i + 1}`,
    description: `This is the description for item ${i + 1}`,
    imageUrl: `https://picsum.photos/200/150?random=${i + 1}`,
    category: ['Technology', 'Science', 'Education', 'Health'][i % 4],
    createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString()
  }));

const MOCK_ITEMS = generateMockItems(1000);

// Mock API function
const mockApiCall = async (page: number, limit: number, filters?: any) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const items = MOCK_ITEMS.slice(startIndex, endIndex);
  
  return {
    success: true,
    data: {
      data: items,
      pagination: {
        page,
        limit,
        total: MOCK_ITEMS.length,
        totalPages: Math.ceil(MOCK_ITEMS.length / limit),
        hasNext: endIndex < MOCK_ITEMS.length,
        hasPrev: page > 1
      }
    }
  };
};

// Infinite Scroll Example
function InfiniteScrollExample() {
  const [items, setItems] = useState(MOCK_ITEMS.slice(0, 20));
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    if (loading) return;
    
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const nextItems = MOCK_ITEMS.slice(items.length, items.length + 20);
    setItems(prev => [...prev, ...nextItems]);
    setHasMore(items.length + nextItems.length < MOCK_ITEMS.length);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Infinite Scroll Example</CardTitle>
        <CardDescription>
          Automatically loads more content as you scroll to the bottom
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InfiniteScrollContainer
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={loading}
          className="h-96 border rounded-md p-4"
          loadingComponent={
            <div className="text-center py-4">Loading more items...</div>
          }
          endMessage={
            <div className="text-center py-4 text-muted-foreground">
              You've reached the end!
            </div>
          }
        >
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs bg-secondary px-2 py-1 rounded">
                    {item.category}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </InfiniteScrollContainer>
      </CardContent>
    </Card>
  );
}

// Virtual List Example
function VirtualListExample() {
  const items = MOCK_ITEMS;

  const renderItem = (item: typeof items[0], index: number, isScrolling: boolean) => (
    <div className="flex items-center gap-4 p-4 border-b">
      <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
        {item.id}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold">{item.title}</h3>
        {!isScrolling && (
          <p className="text-sm text-muted-foreground">{item.description}</p>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {item.category}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Virtual List Example</CardTitle>
        <CardDescription>
          Efficiently renders large lists by only showing visible items
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VirtualList
          items={items}
          itemHeight={80}
          containerHeight={400}
          renderItem={renderItem}
          className="border rounded-md"
        />
        <div className="mt-2 text-sm text-muted-foreground">
          Showing {items.length} items with virtual scrolling
        </div>
      </CardContent>
    </Card>
  );
}

// Lazy Loading Images Example
function LazyImageExample() {
  const images = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    url: `https://picsum.photos/300/200?random=${i + 1}`,
    title: `Image ${i + 1}`
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lazy Loading Images</CardTitle>
        <CardDescription>
          Images load only when they come into view
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96 overflow-auto border rounded-md p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((image) => (
              <div key={image.id} className="space-y-2">
                <LazyImage
                  src={image.url}
                  alt={image.title}
                  className="w-full h-32 object-cover rounded"
                  wrapperClassName="w-full h-32 rounded bg-muted"
                  placeholder={
                    <div className="w-full h-32 bg-muted rounded flex items-center justify-center">
                      <span className="text-muted-foreground">Loading...</span>
                    </div>
                  }
                />
                <p className="text-sm font-medium">{image.title}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Pagination Controls Example
function PaginationExample() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalItems = MOCK_ITEMS.length;

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentItems = MOCK_ITEMS.slice(startIndex, endIndex);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagination Controls</CardTitle>
        <CardDescription>
          Traditional pagination with page controls
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {currentItems.map((item) => (
            <div key={item.id} className="border rounded-lg p-3">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
        
        <PaginationControls
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          className="mt-4"
        />
      </CardContent>
    </Card>
  );
}

// Main Example Component
export function PaginationExample() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Pagination & Lazy Loading Examples</h1>
        <p className="text-muted-foreground">
          Demonstrations of various pagination and performance optimization techniques
        </p>
      </div>

      <Tabs defaultValue="infinite-scroll" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="infinite-scroll">Infinite Scroll</TabsTrigger>
          <TabsTrigger value="virtual-list">Virtual List</TabsTrigger>
          <TabsTrigger value="lazy-images">Lazy Images</TabsTrigger>
          <TabsTrigger value="pagination">Pagination</TabsTrigger>
        </TabsList>

        <TabsContent value="infinite-scroll">
          <InfiniteScrollExample />
        </TabsContent>

        <TabsContent value="virtual-list">
          <VirtualListExample />
        </TabsContent>

        <TabsContent value="lazy-images">
          <LazyImageExample />
        </TabsContent>

        <TabsContent value="pagination">
          <PaginationExample />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PaginationExample;