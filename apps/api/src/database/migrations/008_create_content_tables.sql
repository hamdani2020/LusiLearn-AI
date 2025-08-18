-- Migration: Create content-related tables
-- Description: Creates tables for content items, bookmarks, and interactions

-- Content items table
CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    quality_metrics JSONB NOT NULL DEFAULT '{}',
    age_rating VARCHAR(20) NOT NULL DEFAULT 'all_ages',
    embeddings JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(source, external_id),
    CHECK (source IN ('youtube', 'khan_academy', 'coursera', 'github', 'internal')),
    CHECK (age_rating IN ('all_ages', 'teen', 'adult'))
);

-- Content bookmarks table
CREATE TABLE IF NOT EXISTS content_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    tags JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, content_id)
);

-- Content interactions table
CREATE TABLE IF NOT EXISTS content_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL,
    duration INTEGER, -- in seconds
    progress INTEGER, -- percentage 0-100
    rating INTEGER, -- 1-5 stars
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CHECK (interaction_type IN ('view', 'complete', 'bookmark', 'rate', 'share', 'report')),
    CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

-- Content reports table
CREATE TABLE IF NOT EXISTS content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    severity VARCHAR(10) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by UUID,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CHECK (severity IN ('low', 'medium', 'high')),
    CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_items_source ON content_items(source);
CREATE INDEX IF NOT EXISTS idx_content_items_active ON content_items(is_active);
CREATE INDEX IF NOT EXISTS idx_content_items_metadata_subject ON content_items USING GIN ((metadata->>'subject'));
CREATE INDEX IF NOT EXISTS idx_content_items_metadata_difficulty ON content_items USING GIN ((metadata->>'difficulty'));
CREATE INDEX IF NOT EXISTS idx_content_items_quality_rating ON content_items USING GIN ((quality_metrics->>'userRating'));
CREATE INDEX IF NOT EXISTS idx_content_items_created_at ON content_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_bookmarks_user_id ON content_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_content_id ON content_bookmarks(content_id);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_created_at ON content_bookmarks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_interactions_user_id ON content_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_content_id ON content_interactions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_type ON content_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_content_interactions_timestamp ON content_interactions(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_content_reports_content_id ON content_reports(content_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at ON content_reports(created_at DESC);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_content_items_search ON content_items USING GIN (
    to_tsvector('english', title || ' ' || description)
);

-- Sample content data for testing
INSERT INTO content_items (
    source, external_id, url, title, description, thumbnail_url, metadata, quality_metrics, age_rating
) VALUES 
(
    'youtube',
    'dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'Introduction to JavaScript Programming',
    'Learn the basics of JavaScript programming language with practical examples and exercises.',
    'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    '{"subject": "programming", "difficulty": "beginner", "format": "video", "duration": 1800, "topics": ["javascript", "programming", "web development"], "learningObjectives": ["Understand JavaScript syntax", "Write basic programs", "Use variables and functions"]}',
    '{"userRating": 4.5, "completionRate": 0.85, "effectivenessScore": 88, "reportCount": 0, "ratingCount": 150, "lastUpdated": "2024-01-15T10:00:00Z"}',
    'all_ages'
),
(
    'khan_academy',
    'intro-algebra',
    'https://www.khanacademy.org/math/algebra/introduction-to-algebra',
    'Introduction to Algebra',
    'Master the fundamentals of algebra with step-by-step explanations and practice problems.',
    'https://cdn.kastatic.org/images/algebra-intro.png',
    '{"subject": "mathematics", "difficulty": "intermediate", "format": "interactive", "duration": 2400, "topics": ["algebra", "equations", "variables"], "learningObjectives": ["Solve linear equations", "Work with variables", "Understand algebraic expressions"]}',
    '{"userRating": 4.8, "completionRate": 0.92, "effectivenessScore": 95, "reportCount": 0, "ratingCount": 320, "lastUpdated": "2024-01-15T10:00:00Z"}',
    'all_ages'
),
(
    'youtube',
    'python-tutorial',
    'https://www.youtube.com/watch?v=python-tutorial',
    'Python Programming for Beginners',
    'Complete Python tutorial covering variables, functions, loops, and object-oriented programming.',
    'https://img.youtube.com/vi/python-tutorial/maxresdefault.jpg',
    '{"subject": "programming", "difficulty": "beginner", "format": "video", "duration": 3600, "topics": ["python", "programming", "oop"], "learningObjectives": ["Write Python programs", "Use loops and conditions", "Create classes and objects"]}',
    '{"userRating": 4.7, "completionRate": 0.78, "effectivenessScore": 90, "reportCount": 0, "ratingCount": 280, "lastUpdated": "2024-01-15T10:00:00Z"}',
    'all_ages'
),
(
    'coursera',
    'machine-learning-basics',
    'https://www.coursera.org/learn/machine-learning-basics',
    'Machine Learning Fundamentals',
    'Introduction to machine learning concepts, algorithms, and practical applications.',
    'https://coursera-course-photos.s3.amazonaws.com/ml-basics.jpg',
    '{"subject": "data-science", "difficulty": "advanced", "format": "tutorial", "duration": 7200, "topics": ["machine learning", "ai", "algorithms"], "learningObjectives": ["Understand ML concepts", "Implement basic algorithms", "Apply ML to real problems"]}',
    '{"userRating": 4.6, "completionRate": 0.65, "effectivenessScore": 85, "reportCount": 0, "ratingCount": 95, "lastUpdated": "2024-01-15T10:00:00Z"}',
    'teen'
),
(
    'youtube',
    'react-hooks-tutorial',
    'https://www.youtube.com/watch?v=react-hooks',
    'React Hooks Complete Guide',
    'Learn React Hooks including useState, useEffect, useContext, and custom hooks with practical examples.',
    'https://img.youtube.com/vi/react-hooks/maxresdefault.jpg',
    '{"subject": "programming", "difficulty": "intermediate", "format": "video", "duration": 2700, "topics": ["react", "javascript", "web development", "hooks"], "learningObjectives": ["Master React Hooks", "Build interactive UIs", "Manage component state"]}',
    '{"userRating": 4.9, "completionRate": 0.88, "effectivenessScore": 92, "reportCount": 0, "ratingCount": 420, "lastUpdated": "2024-01-15T10:00:00Z"}',
    'all_ages'
)
ON CONFLICT (source, external_id) DO NOTHING;