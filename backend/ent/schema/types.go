package schema

// APMDataPoint represents a single APM data point at a specific frame.
type APMDataPoint struct {
	Frame int     `json:"frame"`
	APM   float64 `json:"apm"`
}

// PlayerAPMTimeline holds the APM timeline for a single player.
type PlayerAPMTimeline struct {
	PlayerName string         `json:"player_name"`
	DataPoints []APMDataPoint `json:"data_points"`
}

// BuildEvent represents a single build order event.
type BuildEvent struct {
	Frame       int    `json:"frame"`
	EndFrame    int    `json:"end_frame,omitempty"`
	Count       int    `json:"count,omitempty"`
	EventType   string `json:"event_type,omitempty"` // build/train/tech/upgrade/cancel_*
	Unit        string `json:"unit,omitempty"`       // unit/building name
	Tech        string `json:"tech,omitempty"`       // research tech name
	Upgrade     string `json:"upgrade,omitempty"`    // upgrade name
	Order       string `json:"order,omitempty"`      // command order name
	X           int    `json:"x,omitempty"`          // build/move position X
	Y           int    `json:"y,omitempty"`          // build/move position Y
	IsMorph     bool   `json:"is_morph,omitempty"`   // legacy compatibility
	IsEffective bool   `json:"is_effective"`         // derived from IneffKind
	IneffKind   string `json:"ineff_kind,omitempty"` // effective / repetition / ...
	IsQueued    bool   `json:"is_queued,omitempty"`  // command had queue flag
}

// PlayerBuildOrder holds the build order for a single player.
type PlayerBuildOrder struct {
	PlayerName string       `json:"player_name"`
	Events     []BuildEvent `json:"events"`
}

// ChatMessage represents a single in-game chat message.
type ChatMessage struct {
	Frame      int    `json:"frame"`
	SenderName string `json:"sender_name"`
	Message    string `json:"message"`
}
