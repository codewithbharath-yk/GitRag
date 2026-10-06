-- =====================================================================
-- CodeRAG PostgreSQL / Supabase Production Database Schema
-- Complete table definitions, indexes, foreign keys, and RLS policies
-- =====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users / Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);


-- 3. Repositories Table (User Ownership Model)
CREATE TABLE IF NOT EXISTS public.repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    repository_id TEXT NOT NULL, -- e.g. "octocat__spoon-knife"
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    default_branch TEXT DEFAULT 'main' NOT NULL,
    selected_branch TEXT DEFAULT 'main' NOT NULL,
    is_private BOOLEAN DEFAULT FALSE NOT NULL,
    description TEXT,
    stars_count INTEGER DEFAULT 0,
    forks_count INTEGER DEFAULT 0,
    language TEXT,
    total_files INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_repository UNIQUE (user_id, repository_id)
);

-- Indexes for fast lookup & isolation
CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON public.repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_repositories_repo_id ON public.repositories(repository_id);

-- Enable RLS on repositories
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own repositories"
    ON public.repositories FOR ALL
    USING (auth.uid() = user_id);


-- 4. Indexing Jobs Table
CREATE TABLE IF NOT EXISTS public.indexing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    repository_id TEXT NOT NULL,
    branch TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'indexing', 'completed', 'failed')),
    files_discovered INTEGER DEFAULT 0,
    files_indexed INTEGER DEFAULT 0,
    chunks_indexed INTEGER DEFAULT 0,
    duration_ms DOUBLE PRECISION,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_indexing_jobs_user_repo ON public.indexing_jobs(user_id, repository_id);

ALTER TABLE public.indexing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own indexing jobs"
    ON public.indexing_jobs FOR ALL
    USING (auth.uid() = user_id);


-- 5. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    repository_id TEXT NOT NULL,
    title TEXT DEFAULT 'New Conversation' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_repo ON public.conversations(user_id, repository_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own conversations"
    ON public.conversations FOR ALL
    USING (auth.uid() = user_id);


-- 6. Messages Table (Chat History)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    insufficient_context BOOLEAN DEFAULT FALSE,
    retrieved_chunks_count INTEGER DEFAULT 0,
    latency_ms DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access messages in their own conversations"
    ON public.messages FOR ALL
    USING (auth.uid() = user_id);


-- 7. Repository Settings Table
CREATE TABLE IF NOT EXISTS public.repository_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    repository_id TEXT NOT NULL,
    chunk_size_lines INTEGER DEFAULT 35,
    chunk_overlap_lines INTEGER DEFAULT 5,
    custom_ignore_patterns TEXT[] DEFAULT ARRAY[]::TEXT[],
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_repo_settings UNIQUE (user_id, repository_id)
);

ALTER TABLE public.repository_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own repository settings"
    ON public.repository_settings FOR ALL
    USING (auth.uid() = user_id);
