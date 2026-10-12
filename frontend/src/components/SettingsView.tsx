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
import { BackButton } from './BackButton';
import { useNavigation } from '../context/NavigationContext';
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
  const { settingsSection, setSettingsSection } = useNavigation();
  const activeSettingsTab = (settingsSection as 'profile' | 'appearance' | 'integrations' | 'models') || 'appearance';
  const setActiveSettingsTab = (tab: 'profile' | 'appearance' | 'integrations' | 'models') => setSettingsSection(tab);

  const [enableAnimations, setEnableAnimations] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(false);
  const [activeAccent, setActiveAccent] = useState('#1546D9');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-4 sm:p-6 lg:p-8 text-[var(--text-primary)] font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with Visible Back Button */}
        <div className="pb-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton label="Back" tooltip="Return to Dashboard" fallback={{ tab: 'dashboard' }} />
            <div>
              <TextEffect as="h1" variant="blur-up" className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                Settings
              </TextEffect>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                Manage your appearance, theme mode, integrations, and AI models
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-1 overflow-x-auto">
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
                  ? 'bg-[#1546D9] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
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
              <h2 className="text-sm font-bold text-[var(--text-primary)] mb-1">Theme Mode</h2>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Select your preferred interface surface style
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Dark Ink Card */}
                <Tilt maxAngle={5} scale={1.02}>
                  <div
                    onClick={() => setTheme('dark')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      theme === 'dark' || (theme === 'system' && actualTheme === 'dark')
                        ? 'bg-[var(--bg-card)] border-[#1546D9] ring-1 ring-[#1546D9]/40 shadow-lg'
                        : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)] text-[#1546D9]">
                        <Moon className="w-5 h-5 text-[#1546D9]" />
                      </div>
                      {(theme === 'dark' || (theme === 'system' && actualTheme === 'dark')) && (
                        <Check className="w-4 h-4 text-[#F9B318]" />
                      )}
                    </div>
                    <div className="font-bold text-sm text-[var(--text-primary)]">Dark Ink</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Dark Ink (#111318) high-contrast canvas
                    </div>
                  </div>
                </Tilt>

                {/* Light Mode Card */}
                <Tilt maxAngle={5} scale={1.02}>
                  <div
                    onClick={() => setTheme('light')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      theme === 'light' || (theme === 'system' && actualTheme === 'light')
                        ? 'bg-[var(--bg-card)] border-[#1546D9] ring-1 ring-[#1546D9]/40 shadow-lg'
                        : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-xl bg-[#EDECE6] text-[#111318] border border-[var(--border-subtle)] shadow-xs">
                        <Sun className="w-5 h-5 text-[#F9B318]" />
                      </div>
                      {(theme === 'light' || (theme === 'system' && actualTheme === 'light')) && (
                        <Check className="w-4 h-4 text-[#F9B318]" />
                      )}
                    </div>
                    <div className="font-bold text-sm text-[var(--text-primary)]">Light Mode</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Warm Beige (#EDECE6) clean canvas
                    </div>
                  </div>
                </Tilt>

                {/* System Mode Card */}
                <Tilt maxAngle={5} scale={1.02}>
                  <div
                    onClick={() => setTheme('system')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      theme === 'system'
                        ? 'bg-[var(--bg-card)] border-[#1546D9] ring-1 ring-[#1546D9]/40 shadow-lg'
                        : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                        <Laptop className="w-5 h-5" />
                      </div>
                      {theme === 'system' && <Check className="w-4 h-4 text-[#F9B318]" />}
                    </div>
                    <div className="font-bold text-sm text-[var(--text-primary)]">System</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Follows OS color preference
                    </div>
                  </div>
                </Tilt>
              </div>
            </div>

            {/* Accent Color Selection */}
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] mb-1">Accent Color</h2>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Four official CodeRAG brand colors
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { name: 'Warm Beige', hex: '#EDECE6', textDark: true },
                  { name: 'Cobalt Blue', hex: '#1546D9', textDark: false },
                  { name: 'Sun Yellow', hex: '#F9B318', textDark: true },
                  { name: 'Dark Ink', hex: '#111318', textDark: false },
                ].map((color) => (
                  <button
                    key={color.hex}
                    onClick={() => setActiveAccent(color.hex)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-card)] border transition-all cursor-pointer ${
                      activeAccent === color.hex
                        ? 'border-[#1546D9] ring-2 ring-[#1546D9]/40 shadow-sm'
                        : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full border border-black/20 flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: color.hex }}
                    >
                      {activeAccent === color.hex && (
                        <Check className={`w-3.5 h-3.5 ${color.textDark ? 'text-[#111318]' : 'text-white'}`} />
                      )}
                    </span>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{color.name}</span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">{color.hex}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Display & Animations */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Display & Motion Settings</h2>

              <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">
                      Enable Animations
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Smooth TextEffect, Spotlight, Tilt, and Magnetic motion
                    </span>
                  </div>
                  <button
                    onClick={() => setEnableAnimations((prev) => !prev)}
                    className="text-[#1546D9] p-1 cursor-pointer"
                  >
                    {enableAnimations ? (
                      <ToggleRight className="w-7 h-7 text-[#1546D9]" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-[var(--text-muted)]" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">
                      Reduce Motion
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Respect accessibility preferences and bypass transforms
                    </span>
                  </div>
                  <button
                    onClick={() => setReduceMotion((prev) => !prev)}
                    className="text-[#1546D9] p-1 cursor-pointer"
                  >
                    {reduceMotion ? (
                      <ToggleRight className="w-7 h-7 text-[#1546D9]" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-[var(--text-muted)]" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">
                      Compact Sidebar
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Condense navigation icons for wider code canvas
                    </span>
                  </div>
                  <button
                    onClick={() => setCompactSidebar((prev) => !prev)}
                    className="text-[#1546D9] p-1 cursor-pointer"
                  >
                    {compactSidebar ? (
                      <ToggleRight className="w-7 h-7 text-[#1546D9]" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-[var(--text-muted)]" />
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
            <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src="/user_avatar.svg"
                    alt={userProfile?.name || 'Developer'}
                    className="w-14 h-14 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-well)] p-1 shadow-md"
                  />
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">{userProfile?.name || 'Bharath Kumar'}</h3>
                    <p className="text-xs text-[#F9B318] font-mono font-semibold">{userProfile?.role || 'Full-Stack Developer'}</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono">{userProfile?.email || 'bharath@coderag.ai'}</p>
                  </div>
                </div>

                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="px-3.5 py-1.5 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
                <div>
                  <label className="text-[11px] text-[var(--text-muted)] block mb-1">Account Gmail</label>
                  <input
                    type="text"
                    disabled
                    value={userProfile?.email || 'bharath@coderag.ai'}
                    className="w-full p-2 rounded-lg bg-[var(--bg-well)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--text-muted)] block mb-1">Session Access</label>
                  <input
                    type="text"
                    disabled
                    value="Verified Active Session"
                    className="w-full p-2 rounded-lg bg-[var(--bg-well)] border border-[var(--border-subtle)] text-[#10B981] font-mono font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Integrations */}
        {activeSettingsTab === 'integrations' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-[#1546D9]" />
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">Qdrant Vector Database</span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">http://localhost:6333</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-semibold">
                  CONNECTED
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-[#F9B318]" />
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">Local Embeddings Provider</span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">BAAI/bge-small-en-v1.5</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-semibold">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: API & Models */}
        {activeSettingsTab === 'models' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[#F9B318]" />
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">Gemini Answer Model</span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">gemini-flash-lite-latest</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-semibold">
                  ONLINE
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">RAG Mode</span>
                  <span className="font-mono text-[var(--text-primary)] font-semibold">Lazy Question-Driven</span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Top K Chunks</span>
                  <span className="font-mono text-[var(--text-primary)] font-semibold">5 source chunks</span>
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
              className="py-2.5 px-5 rounded-xl bg-[#1546D9] hover:bg-[#2255EB] text-white text-xs font-bold flex items-center gap-2 border border-[#1546D9] shadow-md transition-all active:scale-[0.98] cursor-pointer"
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

export default SettingsView;
