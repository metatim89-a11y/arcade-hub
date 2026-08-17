import React from 'react';
import GlassButton from './ui/GlassButton';

type SupportPageProps = { onBack: () => void };
const paypalUrl = String(import.meta.env.VITE_PAYPAL_URL || '').trim();

const SupportPage: React.FC<SupportPageProps> = ({ onBack }) => (
  <section className="w-full max-w-4xl px-4 py-10 text-white">
    <div className="rounded-3xl border border-yellow-300/20 bg-slate-950/70 p-6 shadow-2xl backdrop-blur sm:p-10">
      <p className="text-xs font-black uppercase tracking-[.25em] text-yellow-300">Help build the arcade</p>
      <h2 className="mt-2 text-4xl font-black text-white sm:text-5xl">Support Arcade Hub</h2>
      <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">Arcade Hub is an independent project. Support helps cover hosting, sound, art, accessibility, and the time it takes to finish new games.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ['🎮', 'Play and share', 'Invite friends and share the games you enjoy.'],
          ['💡', 'Sponsor a game', 'Businesses can sponsor a game, tournament, or themed event.'],
          ['🛠️', 'Give feedback', 'Tell us which game needs the next development pass.'],
        ].map(([icon, title, copy]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4"><span className="text-3xl" aria-hidden="true">{icon}</span><h3 className="mt-3 font-black text-yellow-200">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{copy}</p></div>)}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        {paypalUrl && <a className="rounded-xl bg-[#0070ba] px-5 py-3 font-black text-white transition hover:bg-[#005ea6]" href={paypalUrl} target="_blank" rel="noopener noreferrer">💙 Support with PayPal</a>}
        <a className="rounded-xl bg-yellow-300 px-5 py-3 font-black text-slate-950 transition hover:bg-yellow-200" href="https://github.com/metatim89-a11y/arcade-hub/issues/new?title=Arcade%20Hub%20sponsorship%20inquiry" target="_blank" rel="noopener noreferrer">Sponsor or contact us</a>
        <a className="rounded-xl border border-cyan-200/30 bg-cyan-950/60 px-5 py-3 font-black text-cyan-100 transition hover:bg-cyan-900" href="https://github.com/metatim89-a11y/arcade-hub" target="_blank" rel="noopener noreferrer">View the project</a>
        <GlassButton onClick={onBack}>Back to Arcade</GlassButton>
      </div>
      <p className="mt-6 text-xs leading-5 text-slate-400">Payment support is not active yet. When a payment or sponsorship account is set up, its verified link can be added here without changing the games.</p>
    </div>
  </section>
);

export default SupportPage;
