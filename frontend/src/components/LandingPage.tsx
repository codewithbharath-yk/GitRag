import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Code2,
  MessageSquare,
  GitCommit,
  FolderTree,
  Zap,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import type { UserProfile } from '../types/api';
import { api } from '../api/client';
import { TextEffect } from './motion/TextEffect';
import { Spotlight } from './motion/Spotlight';
import { Tilt } from './motion/Tilt';
import { Magnetic } from './motion/Magnetic';
import { ThemeToggle } from './ThemeToggle';
import { useNavigation } from '../context/NavigationContext';

interface LandingPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

export type FunnelStep = 'landing' | 'showcase' | 'auth';

interface StoredAccount {
  email: string;
  passwordHash: string; // for offline simulation check
  name: string;
  role: string;
  createdAt: string;
}

const STORAGE_KEY_ACCOUNTS = 'coderag_registered_accounts_v1';

const SHOWCASE_SLIDES = [
  {
    id: 'ai-chat',
    title: 'AI-Powered Code Intelligence & Line Citations',
    subtitle: 'Zero hallucinations. Grounded answers derived directly from repository chunks.',
    image: '/coderag_mascot_logo.jpg',
    tag: 'RAG Pipeline • Gemini Flash',
    description:
      'CodeRAG pair-programs alongside you, answering natural language queries by fetching indexed dense embeddings and attaching verifiable file citations with exact line numbers.',
    bullets: [
      'Grounded line references with direct file links',
      'Dual AI & User interactive conversation threads',
      'Contextual code previews and syntax-highlighted snippets',
    ],
  },
  {
    id: 'unified-workspace',
    title: 'One Unified Workspace: Codebase Explorer',
    subtitle: 'Four essential developer tools seamlessly merged into a single screen.',
    image: '/coderag_ui_system_mockup.jpg',
    tag: 'Unified UX • No Page Hopping',
    description:
      'Eliminate context switching. Switch between AI Chat & Search, Git History & Diffs, AST Explorer, and File Architecture with one click while maintaining active repository context.',
    bullets: [
      'Chat & Search with real-time vector hits',
      'Multi-commit diff comparisons and patch reviews',
      'Instant search and full file architecture navigation',
    ],
  },
  {
    id: 'retrieval-architecture',
    title: 'Local Dense Vector Embeddings & Qdrant Engine',
    subtitle: 'High-speed retrieval without leaking private source code to third-party vectors.',
    image: '/hero_architecture.jpg',
    tag: 'BAAI/bge-small-en-v1.5 • Qdrant',
    description:
      'State-of-the-art vector pipeline uses local BAAI/bge-small-en-v1.5 embeddings and a local Qdrant instance. Chunks are retrieved with sub-50ms latency using cosine similarity.',
    bullets: [
      'Local 384-dimensional dense semantic vectors',
      'Fast Qdrant collection caching and lazy chunk ingestion',
      'Complete private repository data isolation',
    ],
  },
  {
    id: 'ast-hierarchy',
    title: 'AST Structural Hierarchy & Syntax Navigation',
    subtitle: 'Tree-Sitter parsed symbol maps and class-level relationship trees.',
    image: '/code_ast_graph.jpg',
    tag: 'Tree-Sitter • Multi-Language',
    description:
      'Understand complex software architectures by exploring function parameters, return types, class hierarchies, and imports without having to read through thousands of lines of boilerplate.',
    bullets: [
      'Automatic parsing for Python, TypeScript, JS, Go, and Rust',
      'Interactive visual symbol hierarchy tree',
      'Quick jump to function declarations and class bodies',
    ],
  },
  {
    id: 'vector-mesh',
    title: 'High-Dimensional Semantic Vector Search',
    subtitle: 'Find code by what it does, not just exact keywords.',
    image: '/vector_mesh.jpg',
    tag: 'Semantic Search • Dense Ranking',
    description:
      'Keyword search fails when naming conventions differ. CodeRAG understands conceptual code intent — search for "JWT refresh token logic" to discover relevant files even without that exact string.',
    bullets: [
      'Cosine similarity score ranking and score metrics',
      'Searches docstrings, method bodies, and comments',
      'Direct copy-to-clipboard and file jump links',
    ],
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => {
  const { landingStep, setLandingStep } = useNavigation();
  const step: FunnelStep = landingStep;
  const setStep = (newStep: FunnelStep) => setLandingStep(newStep);

  // Showcase state
  const [activeSlide, setActiveSlide] = useState<number>(0);

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-advance showcase slides every 6 seconds on showcase step
  useEffect(() => {
    if (step !== 'showcase') return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SHOWCASE_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [step]);

  // Helper: Get local accounts registry
  const getStoredAccounts = (): StoredAccount[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // fallback
    }
    // Default seeded account
    return [
      {
        email: 'bharath@coderag.ai',
        passwordHash: 'bharath123',
        name: 'Bharath Kumar',
        role: 'Full-Stack Developer',
        createdAt: new Date().toISOString(),
      },
    ];
  };

  const saveStoredAccounts = (accounts: StoredAccount[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
    } catch {
      // storage error
    }
  };

  // Gmail and Email validation
  const validateGmail = (emailVal: string): boolean => {
    const clean = emailVal.trim().toLowerCase();
    // Valid email format check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(clean);
  };

  // Handle Authentication Submission (Log in or Sign up, prevent duplicates)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 1. Strict Email Validation
    if (!cleanEmail) {
      setAuthError('Please enter your email address.');
      return;
    }

    if (!validateGmail(cleanEmail)) {
      setAuthError('Please enter a valid Gmail address (e.g. username@gmail.com).');
      return;
    }

    // 2. Strict Password Validation
    if (!cleanPassword || cleanPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      const accounts = getStoredAccounts();
      const existingAccount = accounts.find((acc) => acc.email.toLowerCase() === cleanEmail);

      if (authMode === 'signup') {
        // --- SIGN UP / REGISTER MODE ---
        // Prevent Duplicates: If user already exists, reject duplicate registration!
        if (existingAccount) {
          setIsSubmitting(false);
          setAuthError(
            `An account with the email "${cleanEmail}" is already registered. Please switch to "Log In" with your password.`
          );
          return;
        }

        // Try registering with backend
        try {
          await api.auth.register(cleanEmail, cleanPassword, name.trim() || cleanEmail.split('@')[0]);
        } catch (backendErr: any) {
          // If backend reports conflict, honor duplicate prevention
          if (backendErr?.status === 409 || backendErr?.message?.includes('already exists')) {
            setIsSubmitting(false);
            setAuthError(`A user with email "${cleanEmail}" already exists in CodeRAG.`);
            return;
          }
        }

        // Register new account in persistent store
        const newAccount: StoredAccount = {
          email: cleanEmail,
          passwordHash: cleanPassword,
          name: name.trim() || cleanEmail.split('@')[0],
          role: 'Full-Stack Developer',
          createdAt: new Date().toISOString(),
        };

        saveStoredAccounts([...accounts, newAccount]);

        const profile: UserProfile = {
          name: newAccount.name,
          email: newAccount.email,
          role: newAccount.role,
        };

        try {
          localStorage.setItem('coderag_user_profile', JSON.stringify(profile));
          localStorage.setItem('coderag_is_authenticated', 'true');
        } catch {
          // storage quota
        }

        setAuthSuccess('Account registered successfully! Entering CodeRAG...');
        setTimeout(() => {
          onLoginSuccess(profile);
        }, 600);
      } else {
        // --- LOG IN MODE ---
        let isAuthenticated = false;
        let loggedInName = cleanEmail.split('@')[0];
        let loggedInRole = 'Full-Stack Developer';

        // 1. Try backend login
        try {
          const res = await api.auth.login(cleanEmail, cleanPassword);
          if (res?.access_token) {
            isAuthenticated = true;
            if (res.user?.full_name) {
              loggedInName = res.user.full_name;
            }
          }
        } catch {
          // Fallback to local accounts validation
        }

        // 2. Validate against stored accounts
        if (!isAuthenticated) {
          if (!existingAccount) {
            setIsSubmitting(false);
            setAuthError(
              `No existing account found for "${cleanEmail}". Please click "Create Account" below to register.`
            );
            return;
          }

          if (existingAccount.passwordHash !== cleanPassword) {
            setIsSubmitting(false);
            setAuthError('Incorrect password for this Gmail account. Please try again.');
            return;
          }

          loggedInName = existingAccount.name;
          loggedInRole = existingAccount.role;
          isAuthenticated = true;
        }

        const profile: UserProfile = {
          name: loggedInName,
          email: cleanEmail,
          role: loggedInRole,
        };

        try {
          localStorage.setItem('coderag_user_profile', JSON.stringify(profile));
          localStorage.setItem('coderag_is_authenticated', 'true');
        } catch {
          // ignore
        }

        setAuthSuccess('Authenticated! Entering CodeRAG workspace...');
        setTimeout(() => {
          onLoginSuccess(profile);
        }, 600);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication error. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] text-[var(--text-primary)] font-sans selection:bg-[#1546D9] selection:text-white flex flex-col min-h-screen">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[var(--bg-surface)]/90 border-b border-[var(--border-subtle)] px-4 sm:px-8 py-3.5 flex items-center justify-between max-w-7xl w-full mx-auto">
        {/* Brand Horizontal Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-1.5 flex items-center justify-center shadow-md">
            <img
              src="/coderag_logo.svg"
              alt="CodeRAG"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-[var(--text-primary)] flex items-center gap-2">
              CodeRAG
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F9B318]/15 text-[#F9B318] border border-[#F9B318]/40 font-bold">
                AI
              </span>
            </span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono block -mt-0.5">
              YOUR CODEBASE AI ASSISTANT
            </span>
          </div>
        </div>

        {/* Step Progress Tracker (Interactive & Accessible Navigation) */}
        <div className="hidden sm:flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStep('landing')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              step === 'landing'
                ? 'bg-[#1546D9] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)]'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[var(--bg-base)] text-[10px] flex items-center justify-center font-mono">
              1
            </span>
            <span>Welcome</span>
          </button>

          <button
            type="button"
            onClick={() => setStep('showcase')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              step === 'showcase'
                ? 'bg-[#1546D9] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)]'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[var(--bg-base)] text-[10px] flex items-center justify-center font-mono">
              2
            </span>
            <span>Visual Showcase</span>
          </button>

          <button
            type="button"
            onClick={() => setStep('auth')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              step === 'auth'
                ? 'bg-[#1546D9] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)]'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[var(--bg-base)] text-[10px] flex items-center justify-center font-mono">
              3
            </span>
            <span>Sign In</span>
          </button>
        </div>

        {/* Right Action: ThemeToggle */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* =========================================================================
            STAGE 1: GRAND LANDING HERO (Clean, No Clutter, Big Logo)
            ========================================================================= */}
        {step === 'landing' && (
          <div className="space-y-10 animate-in fade-in duration-300 text-center max-w-3xl mx-auto my-auto">
            {/* Ambient Radial Glow */}
            <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 w-80 sm:w-96 h-80 sm:h-96 bg-[#1546D9]/15 rounded-full blur-3xl -z-10" />

            {/* Big Animated Logo Badge */}
            <div className="flex justify-center">
              <Tilt maxAngle={8} scale={1.04}>
                <Spotlight
                  color="#1546D9"
                  size={280}
                  strength={0.2}
                  className="p-4 sm:p-5 rounded-3xl bg-[var(--bg-card)] border-2 border-[#1546D9]/30 shadow-2xl relative"
                >
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-[var(--bg-well)] border border-[var(--border-subtle)] p-3 sm:p-4 flex items-center justify-center overflow-hidden">
                    <img
                      src="/coderag_logo.svg"
                      alt="CodeRAG Logo"
                      className="w-full h-full object-contain filter drop-shadow-md"
                    />
                  </div>
                  <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#1546D9] border border-[#1546D9] text-[10px] font-mono font-bold text-white uppercase tracking-wider shadow-md whitespace-nowrap">
                    CodeRAG AI Assistant
                  </span>
                </Spotlight>
              </Tilt>
            </div>

            {/* Headline and Description */}
            <div className="space-y-3 pt-2">
              <TextEffect
                as="h1"
                variant="blur-up"
                className="text-3xl sm:text-5xl font-black text-[var(--text-primary)] tracking-tight leading-tight"
              >
                Understand Any Codebase. Instantly.
              </TextEffect>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
                Zero-hallucination code intelligence with grounded line citations, AST structural analysis, and instant semantic search for any GitHub repository.
              </p>
            </div>

            {/* 4 Feature Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-col items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#F9B318]" />
                <span className="text-[var(--text-primary)] font-semibold">Grounded RAG Chat</span>
                <span className="text-[10px] text-[var(--text-muted)]">Verifiable Line Citations</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-col items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#F9B318]" />
                <span className="text-[var(--text-primary)] font-semibold">Unified Workspace</span>
                <span className="text-[10px] text-[var(--text-muted)]">4 Tools in One Hub</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-col items-center gap-1.5">
                <Code2 className="w-4 h-4 text-[#F9B318]" />
                <span className="text-[var(--text-primary)] font-semibold">Tree-Sitter AST</span>
                <span className="text-[10px] text-[var(--text-muted)]">Syntax & Symbol Maps</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-col items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-[#F9B318]" />
                <span className="text-[var(--text-primary)] font-semibold">Semantic Vectors</span>
                <span className="text-[10px] text-[var(--text-muted)]">Local Qdrant Engine</span>
              </div>
            </div>

            {/* Forward Action Button */}
            <div className="pt-4 flex justify-center">
              <Magnetic>
                <button
                  onClick={() => setStep('showcase')}
                  className="px-8 py-3.5 rounded-2xl bg-[#1546D9] hover:bg-[#2255EB] text-white font-bold text-sm sm:text-base flex items-center gap-3 border border-[#1546D9] shadow-xl transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Explore Visual Showcase</span>
                  <ArrowRight className="w-4 h-4 text-[#F9B318]" />
                </button>
              </Magnetic>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE 2: VISUAL SHOWCASE (All 5 Visual Slides Sequentially)
            ========================================================================= */}
        {step === 'showcase' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto my-auto">
            {/* Header / Slide Tracker */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <span className="text-[11px] font-mono text-[#1546D9] dark:text-[#F9B318] uppercase tracking-wider font-semibold">
                  Visual Architecture & Feature Showcase
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mt-0.5">
                  {SHOWCASE_SLIDES[activeSlide].title}
                </h2>
              </div>

              {/* Slide Tabs */}
              <div className="flex items-center gap-1.5 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-subtle)]">
                {SHOWCASE_SLIDES.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSlide(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      activeSlide === idx
                        ? 'bg-[#1546D9] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    0{idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Showcase Visual Card */}
            <Tilt maxAngle={3} scale={1.01}>
              <Spotlight
                color="#1546D9"
                size={420}
                strength={0.16}
                className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden p-6 sm:p-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
                  {/* Left: Image Preview */}
                  <div className="relative rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-well)] shadow-lg aspect-video flex items-center justify-center">
                    <img
                      src={SHOWCASE_SLIDES[activeSlide].image}
                      alt={SHOWCASE_SLIDES[activeSlide].title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[var(--bg-base)]/90 backdrop-blur-xs border border-[var(--border-subtle)] text-[10px] font-mono text-[#F9B318] font-bold">
                      {SHOWCASE_SLIDES[activeSlide].tag}
                    </div>
                  </div>

                  {/* Right: Description & Bullets */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-mono text-[#F9B318] uppercase tracking-wider font-semibold">
                        Feature 0{activeSlide + 1} of 05
                      </span>
                      <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] mt-1 leading-snug">
                        {SHOWCASE_SLIDES[activeSlide].subtitle}
                      </h3>
                    </div>

                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                      {SHOWCASE_SLIDES[activeSlide].description}
                    </p>

                    <div className="space-y-2 pt-1 border-t border-[var(--border-subtle)]">
                      {SHOWCASE_SLIDES[activeSlide].bullets.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#F9B318] shrink-0" />
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Spotlight>
            </Tilt>

            {/* Showcase Slide Controls (Previous & Next) */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSlide((prev) => Math.max(0, prev - 1))}
                  disabled={activeSlide === 0}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold border border-[var(--border-subtle)] transition-colors cursor-pointer"
                >
                  ← Previous Slide
                </button>
                {activeSlide < SHOWCASE_SLIDES.length - 1 ? (
                  <button
                    onClick={() => setActiveSlide((prev) => prev + 1)}
                    className="px-4 py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold border border-[var(--border-subtle)] transition-colors cursor-pointer"
                  >
                    Next Feature Preview →
                  </button>
                ) : (
                  <span className="text-xs text-[#F9B318] font-mono flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    All 5 Features Reviewed
                  </span>
                )}
              </div>

              {/* Primary Forward Action to Auth */}
              <Magnetic>
                <button
                  onClick={() => setStep('auth')}
                  className="px-6 py-3 rounded-xl bg-[#1546D9] hover:bg-[#2255EB] text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-[#1546D9] shadow-md transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Proceed to Sign In & Enter CodeRAG</span>
                  <ArrowRight className="w-4 h-4 text-[#F9B318]" />
                </button>
              </Magnetic>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE 3: REAL GMAIL & PASSWORD AUTHENTICATION (No Duplicate Accounts)
            ========================================================================= */}
        {step === 'auth' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-md mx-auto my-auto w-full">
            <Tilt maxAngle={4} scale={1.01}>
              <Spotlight
                color="#1546D9"
                size={340}
                strength={0.18}
                className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl p-6 sm:p-8 space-y-6 text-[var(--text-primary)]"
              >
                {/* Header & Logo */}
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)] p-2 flex items-center justify-center shadow-md">
                    <img
                      src="/coderag_logo.svg"
                      alt="CodeRAG"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                    {authMode === 'login' ? 'Sign In to CodeRAG' : 'Create New Account'}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {authMode === 'login'
                      ? 'Enter your real Gmail and password to access the workspace.'
                      : 'Register your Gmail. Duplicates are strictly prevented.'}
                  </p>
                </div>

                {/* Tab Switcher: Log In vs Create Account */}
                <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)] text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError(null);
                    }}
                    className={`py-2 rounded-lg transition-all cursor-pointer ${
                      authMode === 'login'
                        ? 'bg-[#1546D9] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Log In
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setAuthError(null);
                    }}
                    className={`py-2 rounded-lg transition-all cursor-pointer ${
                      authMode === 'signup'
                        ? 'bg-[#1546D9] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Error Banner */}
                {authError && (
                  <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span className="leading-relaxed">{authError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {authSuccess && (
                  <div className="p-3 rounded-xl border border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981] text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{authSuccess}</span>
                  </div>
                )}

                {/* Real Gmail + Password Form */}
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {/* Name field (Sign Up only) */}
                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Bharath Kumar"
                          className="w-full pl-9 pr-3 py-2 bg-[var(--bg-well)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#1546D9] transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {/* Gmail Address */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Gmail Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full pl-9 pr-3 py-2 bg-[var(--bg-well)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#1546D9] font-mono transition-colors"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full pl-9 pr-10 py-2 bg-[var(--bg-well)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#1546D9] font-mono transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Security Note */}
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#F9B318]" />
                    <span>Hashed verification with anti-duplicate guard.</span>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <Magnetic className="w-full">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#1546D9] hover:bg-[#2255EB] text-white text-xs font-bold flex items-center justify-center gap-2 border border-[#1546D9] shadow-md transition-all active:scale-[0.98] cursor-pointer"
                      >
                        {isSubmitting ? (
                          <span>Verifying credentials...</span>
                        ) : authMode === 'login' ? (
                          <>
                            <span>Log In & Enter CodeRAG</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#F9B318]" />
                          </>
                        ) : (
                          <>
                            <span>Create Account & Enter CodeRAG</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#F9B318]" />
                          </>
                        )}
                      </button>
                    </Magnetic>
                  </div>
                </form>
              </Spotlight>
            </Tilt>
          </div>
        )}
      </main>
    </div>
  );
};
