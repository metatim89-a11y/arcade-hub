import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';

type LandingCommentBoardProps = {
  mode: 'regular' | 'adult';
};

type LandingComment = {
  id: number;
  display_name: string;
  body: string;
  created_at: string;
};

const LandingCommentBoard: React.FC<LandingCommentBoardProps> = ({ mode }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<LandingComment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: loadError } = await getSupabase().rpc('get_landing_comments', { p_mode: mode });
      if (loadError) throw loadError;
      setComments((data ?? []).map((row: any) => ({
        id: Number(row.id),
        display_name: String(row.display_name || 'Player'),
        body: String(row.body || ''),
        created_at: String(row.created_at || ''),
      })));
    } catch (loadError: any) {
      setComments([]);
      setError(loadError?.message || 'Comments are unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !user || user.isGuest || posting) return;

    setPosting(true);
    setError('');
    try {
      const { error: postError } = await getSupabase().rpc('post_landing_comment', {
        p_mode: mode,
        p_body: trimmed,
      });
      if (postError) throw postError;
      setBody('');
      await loadComments();
    } catch (postError: any) {
      setError(postError?.message || 'Could not post your comment.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="mt-10 rounded-3xl border border-cyan-400/20 bg-slate-950/75 p-5 shadow-xl md:p-7" aria-label={`${mode} arcade community comment board`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-cyan-300">Community board</p>
          <h2 className="text-3xl font-black text-white">Leave a comment</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Tell us what you played, what felt good, what broke, or what you want added next. This board belongs to the {mode === 'adult' ? '18+ arcade' : 'regular arcade'} landing page.</p>
        </div>
        <button type="button" onClick={() => void loadComments()} className="self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-300 transition hover:border-cyan-300/40 hover:text-white sm:self-auto">Refresh</button>
      </div>

      {!user || user.isGuest ? (
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">Sign in or create an account to leave a comment. Everyone can read the board.</div>
      ) : (
        <form onSubmit={submit} className="mt-5">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="What should we improve next?"
            className="w-full resize-y rounded-2xl border border-slate-700 bg-black/30 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{body.length}/500 · 15-second posting cooldown</span>
            <button type="submit" disabled={!body.trim() || posting} className="rounded-xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{posting ? 'Posting…' : 'Post comment'}</button>
          </div>
        </form>
      )}

      {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="rounded-2xl border border-white/5 bg-white/[.02] p-6 text-center text-sm text-slate-500">No comments yet. Start the board.</p>
        ) : comments.map((comment) => (
          <article key={comment.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm text-white">{comment.display_name}</strong>
              <time className="text-[11px] text-slate-600" dateTime={comment.created_at}>{comment.created_at ? new Date(comment.created_at).toLocaleString() : ''}</time>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{comment.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default LandingCommentBoard;
