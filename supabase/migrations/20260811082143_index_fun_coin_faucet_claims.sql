create index coin_transactions_faucet_claim_idx on public.coin_transactions (user_id, created_at desc)
where reason = 'Fun Coin Faucet';
