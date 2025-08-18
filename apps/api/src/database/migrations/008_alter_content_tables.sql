-- Migration: Alter existing content tables or create new ones
-- Description: Updates content tables to match the required schema

-- First, let's check if content_items exists and alter it if needed
DO $$
BEGIN
    -- Add missing columns to content_items if they don't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_items') THEN
        -- Add metadata column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'metadata') THEN
            ALTER TABLE content_items ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
        END IF;
        
        -- Add quality_metrics column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'quality_metrics') THEN
            ALTER TABLE content_items ADD COLUMN quality_metrics JSONB NOT NULL DEFAULT '{}';
        END IF;
        
        -- Add age_rating column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'age_rating') THEN
            ALTER TABLE content_items ADD COLUMN age_rating VARCHAR(20) NOT NULL DEFAULT 'all_ages';
        END IF;
        
        -- Add embeddings column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'embeddings') THEN
            ALTER TABLE content_items ADD COLUMN embeddings JSONB;
        END IF;
        
        -- Add is_active column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'is_active') THEN
            ALTER TABLE content_items ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        END IF;
        
        -- Add source column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'source') THEN
            ALTER TABLE content_items ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'internal';
        END IF;
        
        -- Add external_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'external_id') THEN
            ALTER TABLE content_items ADD COLUMN external_id VARCHAR(255) NOT NULL DEFAULT '';
        END IF;
        
        -- Add thumbnail_url column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'thumbnail_url') THEN
            ALTER TABLE content_items ADD COLUMN thumbnail_url TEXT;
        END IF;
        
        RAISE NOTICE 'Updated existing content_items table with missing columns';
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE content_items (
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
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created new content_items table';
    END IF;
    
    -- Add constraints if they don't exist
    BEGIN
        ALTER TABLE content_items ADD CONSTRAINT content_items_source_external_id_key UNIQUE(source, external_id);
    EXCEPTION WHEN duplicate_table THEN
        -- Constraint already exists, ignore
    END;
    
    BEGIN
        ALTER TABLE content_items ADD CONSTRAINT content_items_source_check CHECK (source IN ('youtube', 'khan_academy', 'coursera', 'github', 'internal'));
    EXCEPTION WHEN duplicate_object THEN
        -- Constraint already exists, ignore
    END;
    
    BEGIN
        ALTER TABLE content_items ADD CONSTRAINT content_items_age_rating_check CHECK (age_rating IN ('all_ages', 'teen', 'adult'));
    EXCEPTION WHEN duplicate_object THEN
        -- Constraint already exists, ignore
    END;
END $$;

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

-- Indexes for performance (with IF NOT EXISTS equivalent using DO blocks)
DO $$
BEGIN
    -- Create indexes only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_items_source') THEN
        CREATE INDEX idx_content_items_source ON content_items(source);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_items_active') THEN
        CREATE INDEX idx_content_items_active ON content_items(is_active);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_items_metadata_subject') THEN
        CREATE INDEX idx_content_items_metadata_subject ON content_items USING GIN ((metadata->>'subject'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_items_metadata_difficulty') THEN
        CREATE INDEX idx_content_items_metadata_difficulty ON content_items USING GIN ((metadata->>'difficulty'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_items_quality_rating') THEN
        CREATE INDEX idx_content_items_quality_rating ON content_items USING GIN ((quality_metrics->>'userRating'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_items_created_at') THEN
        CREATE INDEX idx_content_items_created_at ON content_items(created_at DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_bookmarks_user_id') THEN
        CREATE INDEX idx_content_bookmarks_user_id ON content_bookmarks(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_bookmarks_content_id') THEN
        CREATE INDEX idx_content_bookmarks_content_id ON content_bookmarks(content_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_bookmarks_created_at') THEN
        CREATE INDEX idx_content_bookmarks_created_at ON content_bookmarks(created_at DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_interactions_user_id') THEN
        CREATE INDEX idx_content_interactions_user_id ON content_interactions(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_interactions_content_id') THEN
        CREATE INDEX idx_content_interactions_content_id ON content_interactions(content_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_interactions_type') THEN
        CREATE INDEX idx_content_interactions_type ON content_interactions(interaction_type);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_interactions_timestamp') THEN
        CREATE INDEX idx_content_interactions_timestamp ON content_interactions(timestamp DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_reports_content_id') THEN
        CREATE INDEX idx_content_reports_content_id ON content_reports(content_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_reports_status') THEN
        CREATE INDEX idx_content_reports_status ON content_reports(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_reports_created_at') THEN
        CREATE INDEX idx_content_reports_created_at ON content_reports(created_at DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_items_search') THEN
        CREATE INDEX idx_content_items_search ON content_items USING GIN (
            to_tsvector('english', title || ' ' || COALESCE(description, ''))
        );
    END IF;
END $$;

-- Sample content data for testing (only insert if table is empty)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM content_items LIMIT 1) THEN
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
        );
        
        RAISE NOTICE 'Inserted sample content data';
    ELSE
        RAISE NOTICE 'Sample content data already exists, skipping insert';
    END IF;
END $$;