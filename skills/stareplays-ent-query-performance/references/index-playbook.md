# Index Playbook

## General

- Put high-selectivity filters first.
- Add index columns that match ORDER BY sequence.
- Use partial indexes for common filtered states.

## Current Repo Candidates

- players(game_players, team)
- players(name, game_players)
- games(start_time desc, created_at desc)
- ranking_3v3(min_games, win_rate desc, wins desc, games desc, name asc)
- analyzer_race_matchups(team_size, games desc, matchup_key asc)
