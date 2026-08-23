# H2H Real-Time Multiplayer System Integration Guide

## Overview

The Head-to-Head (H2H) system has been completely rewritten to support real-time multiplayer matches with:

- **Real-time Score Sync**: Live score updates between players via Supabase Realtime
- **Secure Backend**: All match data stored in Supabase with RLS policies
- **ELO Rating System**: Competitive ranking with dynamic player ratings
- **Match History**: Complete audit trail of past matches
- **Leaderboard**: Global rankings with personal stats

## Database Architecture

### Tables
1. **h2h_matches** - Active and completed match records
2. **h2h_score_events** - Real-time score updates during matches
3. **h2h_leaderboard** - Player ELO ratings and statistics
4. **h2h_match_history** - Archived completed matches

### Realtime Subscriptions
- `h2h_matches` table published for match status updates
- `h2h_score_events` table published for live score streaming

## Backend RPC Functions

### Match Management
- `create_h2h_match(game_id, game_label, stake_gc, duration)` - Create a new match room
- `join_h2h_match(match_id)` - Join an existing match as guest
- `finish_h2h_match(match_id, forfeit?)` - Complete match and distribute rewards

### Score Submission
- `submit_h2h_score(match_id, score, game_data?)` - Submit player score during match
  - Validates user is participant in match
  - Ensures match is in_progress
  - Calculates score delta automatically

### Data Retrieval
- `get_h2h_active_matches()` - Fetch lobby matches (waiting/in_progress)
- `get_h2h_leaderboard(limit=50)` - Global rankings sorted by ELO
- `get_h2h_player_stats(user_id)` - Individual player statistics
- `get_h2h_player_history(user_id, limit=20)` - Match history with results

## Frontend Components

### HeadToHeadLobby
- Displays waiting matches from Supabase
- Create new match rooms with stake selection
- Join by room code or accept open challenges
- Real-time updates via Supabase subscriptions
- Error handling and loading states

### HeadToHeadArena
- Displays active match between two players
- Subscribes to real-time score events
- Passes `h2hMode` and `onScoreUpdate` props to game components
- Timer-based match duration (default 60s)
- Emoji taunt system for player interaction
- Winner determination and reward distribution

### H2HLeaderboard
- Global rankings with ELO ratings
- Personal stats tab showing player performance
- Win percentage, win streaks, total earnings
- Responsive card-based layout

### H2HMatchHistory
- Player's complete match history
- Win/loss records with scores
- ELO changes and rewards earned
- Formatted timestamps (Today, Yesterday, etc)

## Game Component Integration

### How to Add H2H Support to a Game

Games that support H2H mode receive two props:

```typescript
interface GameProps {
  h2hMode?: boolean;           // True when running in H2H mode
  onScoreUpdate?: (score: number) => void;  // Callback to report score
}
```

### Implementation Pattern

```typescript
const MyGame: React.FC<GameProps> = ({ h2hMode, onScoreUpdate }) => {
  const [playerScore, setPlayerScore] = useState(0);

  const updateScore = (newScore: number) => {
    setPlayerScore(newScore);
    
    // In H2H mode, report to backend
    if (h2hMode && onScoreUpdate) {
      onScoreUpdate(newScore);
    }
  };

  return (
    <div>
      {/* Game UI that calls updateScore() when player scores */}
      <div>Score: {playerScore}</div>
    </div>
  );
};

export default MyGame;
```

### Integration Checklist

- [ ] Add `h2hMode?: boolean` to component props
- [ ] Add `onScoreUpdate?: (score: number) => void` to component props
- [ ] Call `onScoreUpdate()` whenever player score changes during H2H match
- [ ] Pass props to game via HeadToHeadArena (already done)
- [ ] Test score submission in dev mode

### Games with H2H Support

Currently supported (add to this list as games are updated):
- *(Add game names here as integration completes)*

Games that need H2H integration:
- All arcade games in `ADULT_GAMES` and `UNDER18_GAMES` can be updated

## Scoring System

### Score Calculation
- **Submission**: `submit_h2h_score()` accepts raw score from game
- **Delta Calculation**: Automatic delta = new_score - previous_score
- **Validation**: Only accepts scores >= previous score (no negative deltas)
- **Real-time Sync**: Subscribed players see opponent's score update instantly

### ELO Rating System
- **K-Factor**: 32 points per match
- **Formula**: Standard chess ELO calculation
- **Initial Rating**: 1500 for new players
- **Updates**: Automatically calculated when match completes
- **Display**: Rounded to nearest integer

## Match Flow

```
1. Player A creates match room
   - Supabase: create_h2h_match()
   - Status: 'waiting'
   - Room code generated
   
2. Player B joins match
   - Supabase: join_h2h_match()
   - Status: 'in_progress'
   - started_at timestamp set
   
3. Both players play game
   - Real-time subscriptions to h2h_score_events
   - Each player's score updates visible to opponent
   - Supabase: submit_h2h_score() called on score changes
   
4. Timer expires (60s default)
   - gameOver flag set in HeadToHeadArena
   
5. Match completion
   - Supabase: finish_h2h_match()
   - Winner determined by final scores
   - ELO ratings calculated
   - Rewards distributed (coins, tickets, experience)
   - Match archived to h2h_match_history
   - Status: 'completed'
   
6. Players see results
   - Victory/defeat modal
   - ELO change displayed
   - Return to lobby
```

## Real-time Subscription Details

### HeadToHeadArena Subscriptions

```typescript
// Subscribe to opponent's score updates
supabase.channel(`match_${room.id}`)
  .on(
    'postgres_changes',
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'h2h_score_events',
      filter: `match_id=eq.${room.id}`
    },
    (payload) => {
      // Update local state with new score
    }
  )
  .subscribe();
```

### Lobby Subscriptions

```typescript
// Watch for new/completed matches
supabase.channel('h2h_matches_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'h2h_matches' }, () => {
    fetchMatches();
  })
  .subscribe();
```

## Security & RLS Policies

### Row-Level Security

- **Players can only join waiting matches**
- **Players can only submit scores in their own matches**
- **Players can only view their match history**
- **ELO ratings are read-only to players**
- **Admin functions require admin_users membership**

### Stake Validation

- **Balance check**: Verify player has sufficient GC before creating/joining
- **Limits**: Minimum 0, maximum 10,000 GC per match
- **Distribution**: Winner receives stake × 2 (both players' combined stakes)

## Error Handling

### Common Errors

1. **"Insufficient GC balance"**
   - User tried to create/join match with more stake than available
   - Solution: Show available balance, suggest lower stake

2. **"Match is not available to join"**
   - Match is no longer waiting (already full or completed)
   - Solution: Refresh lobby and try different match

3. **"Not a participant in this match"**
   - User tried to finish a match they're not in
   - Solution: Should not occur in UI; backend safety check

4. **"Match not found"**
   - Room code entered doesn't exist
   - Solution: Verify room code and try again

## Performance Considerations

### Optimization
- Leaderboard queries limited to top 100 by default
- History queries limited to 50 most recent matches
- Indexes on status, user_id, room_code, created_at
- Match archival keeps h2h_matches table lean

### Scalability
- Supabase Realtime handles 1000s of concurrent subscriptions
- RLS policies ensure users only see relevant data
- Partition by user_id possible for further scaling

## Testing

### Test Scenarios

1. **Create Match**
   - Verify room code uniqueness
   - Verify GC deduction validation
   - Check match appears in lobby immediately

2. **Join Match**
   - Verify guest cannot be host
   - Verify GC check for guest
   - Verify status changes to in_progress

3. **Score Submission**
   - Verify score persists
   - Verify real-time update to opponent
   - Verify delta calculation

4. **Match Completion**
   - Verify ELO calculation
   - Verify rewards distributed
   - Verify history archived

5. **Leaderboard**
   - Verify ELO ordering
   - Verify stats accuracy
   - Verify personal tab shows correct data

## Future Enhancements

- [ ] Matchmaking queue with skill-based pairing
- [ ] Best-of-3 series support
- [ ] Replay system with replay viewer
- [ ] Spectator mode
- [ ] Tournament brackets
- [ ] Seasonal rankings reset
- [ ] Achievement badges for H2H milestones
- [ ] Streaming integration (Twitch, YouTube)
- [ ] Mobile app optimizations
- [ ] Voice/text chat during matches

## Migration Notes

### Breaking Changes from Old System

- **localStorage**: Now uses Supabase (no client-side storage)
- **Simulated scores**: Now real-time multiplayer
- **Demo rooms**: Real rooms only (no hardcoded samples)
- **Props**: Games now receive `h2hMode` and `onScoreUpdate` props

### Migration Path

If upgrading existing games:
1. Update game component props
2. Add score reporting logic
3. Test in development
4. Deploy with feature flag if needed

## Support & Debugging

### Debug Queries

Check active matches:
```sql
select * from h2h_matches where status = 'waiting' order by created_at desc;
```

Check recent scores:
```sql
select * from h2h_score_events order by created_at desc limit 20;
```

Check player stats:
```sql
select * from h2h_leaderboard order by elo_rating desc;
```

### Common Issues

**Scores not updating in real-time?**
- Check browser DevTools → Network → WebSocket connection to Supabase
- Verify subscription is active
- Check RLS policies allow user to see events

**ELO not changing?**
- Verify finish_h2h_match() was called with correct match_id
- Check both players completed the match
- ELO only updates on match completion, not during

**Match stuck in "in_progress"?**
- Check if timer actually expired (60s default)
- Manual finish via database if needed
- Check for JavaScript errors in console
