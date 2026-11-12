import { Languages, Plus } from 'lucide-react';

export default function Header({ t, onToggleLang, onNew, showNew }) {
  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-paper pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:px-6">
        <a href="/" onClick={(e) => { e.preventDefault(); onNew(); }} className="flex min-h-[2.75rem] items-center gap-2.5 rounded">
          <span className="font-serif text-xl font-semibold tracking-tight text-accent">NyAIy</span>
          <span className="hidden text-sm text-muted sm:inline">{t.tagline}</span>
        </a>
        <div className="flex items-center gap-1">
          {showNew && (
            <button type="button" onClick={onNew} className="btn-ghost min-w-[2.75rem]" aria-label={t.newDocument}>
              <Plus size={16} aria-hidden="true" />
              <span className="hidden min-[400px]:inline">{t.newDocument}</span>
            </button>
          )}
          <button type="button" onClick={onToggleLang} className="btn-ghost" aria-label={t.langSwitchLabel}>
            <Languages size={16} aria-hidden="true" />
            {t.langSwitch}
          </button>
        </div>
      </div>
    </header>
  );
}
