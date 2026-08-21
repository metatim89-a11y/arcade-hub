const fs = require('fs');

const file = 'components/shop/AestheticShopPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const packagesSection = `

      <header className="rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-950/80 via-gray-900 to-yellow-950/70 p-7 text-center shadow-2xl mt-12 mb-6">
        <p className="text-xs font-black uppercase tracking-[.3em] text-amber-300">Support the Devs</p>
        <h2 className="mt-2 text-4xl font-black text-white">Coin Packages</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-300">Buy fun GC & RC packages with real money OR tickets to directly support the arcade! This replaces generic "buy me a coffee" links.</p>
      </header>
      
      <div className="grid gap-5 sm:grid-cols-3 xl:grid-cols-4 mb-16">
        {[{
           id: 'pkg1', name: 'Starter Stack', desc: '+5,000 GC / +50 RC', costTk: 1000, price: '$0.99', rc: 50, gc: 5000
        }, {
           id: 'pkg2', name: 'Gamer Haul', desc: '+25,000 GC / +300 RC', costTk: 4500, price: '$3.49', rc: 300, gc: 25000
        }, {
           id: 'pkg3', name: 'Support Tier', desc: '+55,000 GC / +1000 RC', costTk: 9000, price: '$7.99', rc: 1000, gc: 55000
        }, {
           id: 'pkg4', name: 'Mega Whale', desc: '+150,000 GC / +3000 RC', costTk: 20000, price: '$19.99', rc: 3000, gc: 150000
        }].map(pkg => (
           <article key={pkg.id} className="flex flex-col rounded-2xl border border-amber-500/30 bg-gray-900/90 shadow-xl overflow-hidden relative">
              <div className="p-5 text-center bg-black/40 border-b border-amber-500/20 relative">
                  <h3 className="text-xl font-black text-amber-200">{pkg.name}</h3>
                  <div className="text-sm font-bold text-amber-500/80 mt-1">{pkg.desc}</div>
              </div>
              <div className="p-5 flex flex-col gap-3">
                  <button type="button" onClick={() => alert('Real Money Gateway (Stripe/Paypal) coming soon! Checkout for ' + pkg.price)} className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 font-black text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all w-full text-sm">
                      Buy for {pkg.price}
                  </button>
                  <div className="text-center text-xs text-gray-500 font-bold uppercase tracking-widest">- OR -</div>
                  <button type="button" disabled={tickets < pkg.costTk} onClick={() => alert('Ticket conversion coming soon!')} className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-3 font-black text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40 disabled:grayscale active:scale-95 transition-all w-full text-sm">
                      🎟 {pkg.costTk.toLocaleString()} Tickets
                  </button>
              </div>
           </article>
        ))}
      </div>
`;
content = content.replace('{message && <p role="status"', packagesSection + '\n      {message && <p role="status"');

fs.writeFileSync(file, content);

