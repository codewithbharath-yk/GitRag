import React, { useState } from 'react';
import { X, Lock, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Spotlight } from './motion/Spotlight';
import { Magnetic } from './motion/Magnetic';
import { TextEffect } from './motion/TextEffect';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('bharath@coderag.ai');
  const [password, setPassword] = useState('••••••••••••');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onLoginSuccess?.();
        onClose();
      }, 700);
    }, 600);
  };

  const handleGitHubLogin = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onLoginSuccess?.();
        onClose();
      }, 700);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150 font-sans">
      <Spotlight
        color="teal"
        className="relative w-full max-w-md bg-[#162623] border border-[#577877]/40 rounded-2xl p-6 sm:p-8 shadow-2xl text-[#F0F5F7] overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#577877] hover:text-[#F0F5F7] hover:bg-[#1B2D2A] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand & Title */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#1B2D2A] border border-[#577877]/30 p-2 flex items-center justify-center shadow-md">
            <img
              src="/coderag_logo.svg"
              alt="CodeRAG"
              className="w-full h-full object-contain"
            />
          </div>
          <TextEffect as="h2" variant="blur-up" className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Welcome Back
          </TextEffect>
          <p className="text-xs text-[#B9CECC]">
            Continue to your codebase and AI workspace
          </p>
        </div>

        {/* GitHub OAuth Button */}
        <div className="mb-4">
          <Magnetic className="w-full">
            <button
              onClick={handleGitHubLogin}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1B2D2A] hover:bg-[#243D39] border border-[#577877]/40 text-[#F0F5F7] text-xs font-semibold flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>Continue with GitHub</span>
            </button>
          </Magnetic>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-[#577877]/25 w-full" />
          <span className="bg-[#162623] px-3 text-[11px] text-[#577877] font-mono uppercase">
            or
          </span>
          <div className="border-t border-[#577877]/25 w-full" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-medium text-[#B9CECC] mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#577877]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#1B2D2A] border border-[#577877]/30 rounded-lg text-xs text-[#F0F5F7] placeholder-[#577877] focus:outline-none focus:border-[#6DBE9B] font-mono transition-colors"
                placeholder="your@email.com"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-[#B9CECC]">
                Password
              </label>
              <button
                type="button"
                className="text-[10px] text-[#6DBE9B] hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[#577877]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#1B2D2A] border border-[#577877]/30 rounded-lg text-xs text-[#F0F5F7] placeholder-[#577877] focus:outline-none focus:border-[#6DBE9B] font-mono transition-colors"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <div className="pt-2">
            <Magnetic className="w-full">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-[#295255] hover:bg-[#34686C] text-white text-xs font-bold flex items-center justify-center gap-2 border border-[#577877]/40 shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                {isSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#6DBE9B]" />
                    <span>Logged In!</span>
                  </>
                ) : isSubmitting ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Login</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </Magnetic>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-5 text-center text-xs text-[#577877]">
          <span>Don't have an account? </span>
          <button
            type="button"
            onClick={handleSubmit}
            className="text-[#6DBE9B] hover:underline font-semibold"
          >
            Sign up
          </button>
        </div>
      </Spotlight>
    </div>
  );
};
