import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Laptop,
  Check,
  ShieldCheck,
  Cpu,
  Database,
  Key,
  Save,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useTheme, type AppTheme } from '../context/ThemeContext';
import { Spotlight } from './motion/Spotlight';
import { Tilt } from './motion/Tilt';
import { Magnetic } from './motion/Magnetic';
import { TextEffect } from './motion/TextEffect';
import type { UserProfile } from '../types/api';

interface SettingsViewProps {
  onSave?: () => void;
  userProfile?: UserProfile;
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userProfile,
  onLogout,
}) => {
  const { theme, actualTheme, setTheme } = useTheme();
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'profile' | 'appearance' | 'integrations' | 'models'
  >('appearance');

  const [enableAnimations, setEnableAnimations] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(false);
  const [activeAccent, setActiveAccent] = useState('#295255');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#162623] p-4 sm:p-6 lg:p-8 text-[#F0F5F7] font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="pb-2 border-b border-[#577877]/25">
          <TextEffect as="h1" variant="blur-up" className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Settings
          </TextEffect>
          <p className="text-xs sm:text-sm text-[#B9CECC] mt-0.5">
            Manage your appearance, theme mode, integrations, and AI models
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 border-b border-[#577877]/20 pb-1 overflow-x-auto">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'appearance', label: 'Appearance' },
            { id: 'integrations', label: 'Integrations' },
            { id: 'models', label: 'API & Models' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSettingsTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeSettingsTab === tab.id
                  ? 'bg-[#295255] text-white shadow-sm'
                  : 'text-[#B9CECC] hover:text-white hover:bg-[#1B2D2A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content: Appearance */}
        {activeSettingsTab === 'appearance' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Theme Mode Selection */}
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Theme Mode</h2>
              <p className="text-xs text-[#577877] mb-3">
                Select your preferred interface surface style
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Dark Forest Card */}
                <Tilt maxAngle={5} scale={1.02}>
                  <div
                    onClick={() => setTheme('dark')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      theme === 'dark' || (theme === 'system' && actualTheme === 'dark')
                        ? 'bg-[#1E3430] border-[#6DBE9B] ring-1 ring-[#6DBE9B]/40 shadow-lg'
                        : 'bg-[#1B2D2A] border-[#577877]/30 hover:border-[#577877]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-xl bg-[#162623] border border-[#577877]/30 text-[#6DBE9B]">
                        <Moon className="w-5 h-5" />
                      </div>
                      {(theme === 'dark' || (theme === 'system' && actualTheme === 'dark')) && (
                        <Check className="w-4 h-4 text-[#6DBE9B]" />
                      )}
                    </div>
                    <div className="font-bold text-sm text-white">Dark Forest</div>
                    <div className="text-[11px] text-[#577877] mt-0.5">
                      Default deep forest contrast
                    </div>
                  </div>
                </Tilt>

                {/* Light Mode Card */}
                <Tilt maxAngle={5} scale={1.02}>
                  <div
                    onClick={() => setTheme('light')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      theme === 'light' || (theme === 'system' && actualTheme === 'light')
                        ? 'bg-[#1E3430] border-[#6DBE9B] ring-1 ring-[#6DBE9B]/40 shadow-lg'
                        : 'bg-[#1B2D2A] border-[#577877]/30 hover:border-[#577877]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-xl bg-white text-[#162623] shadow-xs">
                        <Sun className="w-5 h-5" />
                      </div>
                      {(theme === 'light' || (theme === 'system' && actualTheme === 'light')) && (
                        <Check className="w-4 h-4 text-[#6DBE9B]" />
                      )}
                    </div>
                    <div className="font-bold text-sm text-white">Light Mode</div>
                    <div className="text-[11px] text-[#577877] mt-0.5">
                      Soft White clean canvas
                    </div>
                  </div>
                </Tilt>

                {/* System Mode Card */}
                <Tilt maxAngle={5} scale={1.02}>
                  <div
                    onClick={() => setTheme('system')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      theme === 'system'
                        ? 'bg-[#1E3430] border-[#6DBE9B] ring-1 ring-[#6DBE9B]/40 shadow-lg'
                        : 'bg-[#1B2D2A] border-[#577877]/30 hover:border-[#577877]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-xl bg-[#111E1C] border border-[#577877]/30 text-[#B9CECC]">
                        <Laptop className="w-5 h-5" />
                      </div>
                      {theme === 'system' && <Check className="w-4 h-4 text-[#6DBE9B]" />}
                    </div>
                    <div className="font-bold text-sm text-white">System</div>
                    <div className="text-[11px] text-[#577877] mt-0.5">
                      Follows OS color preference
                    </div>
                  </div>
                </Tilt>
              </div>
            </div>

            {/* Accent Color Selection */}
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Accent Color</h2>
              <p className="text-xs text-[#577877] mb-3">
                Four canonical brand colors from your approved palette
              </p>
              <div className="flex items-center gap-3">
                {[
                  { name: 'Deep Teal', hex: '#295255' },
                  { name: 'Muted Teal', hex: '#577877' },
                  { name: 'Dark Forest', hex: '#162623' },
                  { name: 'Soft White', hex: '#F0F5F7' },
                ].map((color) => (
                  <button
                    key={color.hex}
                    onClick={() => setActiveAccent(color.hex)}
                    className="flex items-center gap-2 p-2 rounded-xl bg-[#1B2D2A] border border-[#577877]/30 hover:border-white transition-all cursor-pointer"
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color.hex }}
                    >
                      {activeAccent === color.hex && (
                        <Check className="w-3 h-3 text-[#6DBE9B]" />
                      )}
                    </span>
                    <span className="text-xs font-mono text-[#F0F5F7]">{color.hex}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Display & Animations */}
            <div className="space-y-3 pt-2 border-t border-[#577877]/20">
              <h2 className="text-sm font-bold text-white">Display & Motion Settings</h2>

              <div className="p-4 rounded-2xl bg-[#1B2D2A] border border-[#577877]/25 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Enable Animations
                    </span>
                    <span className="text-[11px] text-[#577877]">
                      Smooth TextEffect, Spotlight, Tilt, and Magnetic motion
                    </span>
                  </div>
                  <button
                    onClick={() => setEnableAnimations((prev) => !prev)}
                    className="text-[#6DBE9B] p-1 cursor-pointer"
                  >
                    {enableAnimations ? (
                      <ToggleRight className="w-7 h-7" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-[#577877]" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-[#577877]/15 pt-3">
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Reduce Motion
                    </span>
                    <span className="text-[11px] text-[#577877]">
                      Respect accessibility preferences and bypass transforms
                    </span>
                  </div>
                  <button
                    onClick={() => setReduceMotion((prev) => !prev)}
                    className="text-[#6DBE9B] p-1 cursor-pointer"
                  >
                    {reduceMotion ? (
                      <ToggleRight className="w-7 h-7" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-[#577877]" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-[#577877]/15 pt-3">
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Compact Sidebar
                    </span>
                    <span className="text-[11px] text-[#577877]">
                      Condense navigation icons for wider code canvas
                    </span>
                  </div>
                  <button
                    onClick={() => setCompactSidebar((prev) => !prev)}
                    className="text-[#6DBE9B] p-1 cursor-pointer"
                  >
                    {compactSidebar ? (
                      <ToggleRight className="w-7 h-7" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-[#577877]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Profile */}
        {activeSettingsTab === 'profile' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-5 rounded-2xl bg-[#1B2D2A] border border-[#577877]/25 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src="/user_avatar.svg"
                    alt={userProfile?.name || 'Developer'}
                    className="w-14 h-14 rounded-2xl border border-[#577877]/40 bg-[#162623] p-1 shadow-md"
                  />
                  <div>
                    <h3 className="text-base font-bold text-white">{userProfile?.name || 'Bharath Kumar'}</h3>
                    <p className="text-xs text-[#6DBE9B] font-mono">{userProfile?.role || 'Full-Stack Developer'}</p>
                    <p className="text-xs text-[#577877] font-mono">{userProfile?.email || 'bharath@coderag.ai'}</p>
                  </div>
                </div>

                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="px-3.5 py-1.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#577877]/15 text-xs">
                <div>
                  <label className="text-[11px] text-[#577877] block mb-1">Account Gmail</label>
                  <input
                    type="text"
                    disabled
                    value={userProfile?.email || 'bharath@coderag.ai'}
                    className="w-full p-2 rounded-lg bg-[#111E1C] border border-[#577877]/30 text-[#F0F5F7] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#577877] block mb-1">Session Access</label>
                  <input
                    type="text"
                    disabled
                    value="Verified Active Session"
                    className="w-full p-2 rounded-lg bg-[#111E1C] border border-[#577877]/30 text-[#6DBE9B] font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Integrations */}
        {activeSettingsTab === 'integrations' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-[#1B2D2A] border border-[#577877]/25 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-[#6DBE9B]" />
                  <div>
                    <span className="text-xs font-bold text-white block">Qdrant Vector Database</span>
                    <span className="text-[11px] text-[#577877] font-mono">http://localhost:6333</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-600/30">
                  CONNECTED
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-[#577877]/15 pt-3">
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-[#6DBE9B]" />
                  <div>
                    <span className="text-xs font-bold text-white block">Local Embeddings Provider</span>
                    <span className="text-[11px] text-[#577877] font-mono">BAAI/bge-small-en-v1.5</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-600/30">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: API & Models */}
        {activeSettingsTab === 'models' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-[#1B2D2A] border border-[#577877]/25 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[#6DBE9B]" />
                  <div>
                    <span className="text-xs font-bold text-white block">Gemini Answer Model</span>
                    <span className="text-[11px] text-[#577877] font-mono">gemini-flash-lite-latest</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-600/30">
                  ONLINE
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#577877]/15 text-xs">
                <div>
                  <span className="text-[11px] text-[#577877] block">RAG Mode</span>
                  <span className="font-mono text-white font-semibold">Lazy Question-Driven</span>
                </div>
                <div>
                  <span className="text-[11px] text-[#577877] block">Top K Chunks</span>
                  <span className="font-mono text-white font-semibold">5 source chunks</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Changes Button */}
        <div className="pt-2">
          <Magnetic>
            <button
              onClick={handleSave}
              className="py-2.5 px-5 rounded-xl bg-[#295255] hover:bg-[#34686C] text-white text-xs font-bold flex items-center gap-2 border border-[#577877]/40 shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <Save className="w-4 h-4 text-white" />
              <span>{isSaved ? 'Settings Saved!' : 'Save Preferences'}</span>
            </button>
          </Magnetic>
        </div>
      </div>
    </div>
  );
};
