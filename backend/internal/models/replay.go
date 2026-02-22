package models

// PlayerStats represents computed statistics for a player (not persisted).
type PlayerStats struct {
	PlayerName   string             `json:"player_name"`
	TotalGames   int                `json:"total_games"`
	Wins         int                `json:"wins"`
	Losses       int                `json:"losses"`
	Draws        int                `json:"draws"`
	WinRate      float64            `json:"win_rate"`
	AverageAPM   float64            `json:"average_apm"`
	AverageEAPM  float64            `json:"average_eapm"`
	FavoriteRace string             `json:"favorite_race"`
	RaceStats    map[string]*Record `json:"race_stats"`
	MatchupStats map[string]*Record `json:"matchup_stats"`
	MapStats     map[string]*Record `json:"map_stats"`
}

// Record holds win/loss record for a category.
type Record struct {
	Wins    int     `json:"wins"`
	Losses  int     `json:"losses"`
	Total   int     `json:"total"`
	WinRate float64 `json:"win_rate"`
}
