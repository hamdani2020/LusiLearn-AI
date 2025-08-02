-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE education_level AS ENUM ('k12', 'college', 'professional');
CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE content_source AS ENUM ('youtube', 'khan_academy', 'coursera', 'github', 'internal');
CREATE TYPE age_rating AS ENUM ('all_ages', 'teen', 'adult');
CREATE TYPE content_format AS ENUM ('video', 'article', 'interactive', 'quiz', 'project');
CREATE TYPE learning_style AS ENUM ('visual', 'auditory', 'kinesthetic', 'reading_writing');
CREATE TYPE age_range AS ENUM ('5-12', '13-17', '18-25', '26-40', '40+');
CREATE TYPE moderation_level AS ENUM ('minimal', 'moderate', 'strict');
CREATE TYPE privacy_level AS ENUM ('public', 'friends', 'private');
CREATE TYPE collaboration_activity_type AS ENUM ('study_session', 'discussion', 'project', 'peer_review');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  demographics JSONB NOT NULL,
  learning_preferences JSONB NOT NULL,
  skill_profile JSONB DEFAULT '[]',
  privacy_settings JSONB NOT NULL,
  parental_controls JSONB,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning paths table
CREATE TABLE learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  current_level difficulty_level NOT NULL DEFAULT 'beginner',
  objectives JSONB DEFAULT '[]',
  milestones JSONB DEFAULT '[]',
  progress JSONB NOT NULL,
  adaptation_history JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning sessions table
CREATE TABLE learning_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  content_items JSONB DEFAULT '[]',
  duration INTEGER NOT NULL DEFAULT 0,
  interactions JSONB DEFAULT '[]',
  assessment_results JSONB DEFAULT '[]',
  comprehension_score DECIMAL(5,2) DEFAULT 0,
  engagement_metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content items table
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source content_source NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  metadata JSONB NOT NULL,
  quality_metrics JSONB NOT NULL,
  age_rating age_rating NOT NULL DEFAULT 'all_ages',
  embeddings JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study groups table
CREATE TABLE study_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  topic VARCHAR(100) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  participants JSONB DEFAULT '[]',
  settings JSONB NOT NULL,
  activities JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collaboration sessions table
CREATE TABLE collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  participants JSONB DEFAULT '[]',
  topic VARCHAR(200) NOT NULL,
  duration INTEGER DEFAULT 0,
  activities JSONB DEFAULT '[]',
  outcomes JSONB DEFAULT '[]',
  satisfaction JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User assessments table
CREATE TABLE user_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  level INTEGER NOT NULL,
  confidence INTEGER NOT NULL,
  assessment_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_demographics ON users USING gin(demographics);
CREATE INDEX idx_learning_paths_user_id ON learning_paths(user_id);
CREATE INDEX idx_learning_paths_subject ON learning_paths(subject);
CREATE INDEX idx_learning_paths_current_level ON learning_paths(current_level);
CREATE INDEX idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX idx_learning_sessions_path_id ON learning_sessions(path_id);
CREATE INDEX idx_learning_sessions_created_at ON learning_sessions(created_at);
CREATE INDEX idx_content_items_source ON content_items(source);
CREATE INDEX idx_content_items_metadata ON content_items USING gin(metadata);
CREATE INDEX idx_content_items_age_rating ON content_items(age_rating);
CREATE INDEX idx_content_items_is_active ON content_items(is_active);
CREATE INDEX idx_study_groups_subject ON study_groups(subject);
CREATE INDEX idx_study_groups_topic ON study_groups(topic);
CREATE INDEX idx_study_groups_created_by ON study_groups(created_by);
CREATE INDEX idx_study_groups_is_active ON study_groups(is_active);
CREATE INDEX idx_collaboration_sessions_group_id ON collaboration_sessions(group_id);
CREATE INDEX idx_collaboration_sessions_created_at ON collaboration_sessions(created_at);
CREATE INDEX idx_user_assessments_user_id ON user_assessments(user_id);
CREATE INDEX idx_user_assessments_subject ON user_assessments(subject);

-- Create unique constraints
ALTER TABLE content_items ADD CONSTRAINT unique_source_external_id UNIQUE (source, external_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_paths_updated_at
BEFORE UPDATE ON learning_paths
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_sessions_updated_at
BEFORE UPDATE ON learning_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_items_updated_at
BEFORE UPDATE ON content_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_groups_updated_at
BEFORE UPDATE ON study_groups
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collaboration_sessions_updated_at
BEFORE UPDATE ON collaboration_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_assessments_updated_at
BEFORE UPDATE ON user_assessments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create migrations table for tracking
CREATE TABLE pgmigrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  run_on TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert migration record
INSERT INTO pgmigrations (name) VALUES ('1753427112050_initial-schema');