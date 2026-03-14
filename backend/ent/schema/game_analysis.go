package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// GameAnalysis holds queued/running/completed replay_analyzer jobs per game.
type GameAnalysis struct {
	ent.Schema
}

// Fields of the GameAnalysis.
func (GameAnalysis) Fields() []ent.Field {
	return []ent.Field{
		field.Int("game_id").
			Positive(),
		field.String("file_hash").
			NotEmpty(),
		field.String("bucket_key").
			NotEmpty(),
		field.String("analyzer_version").
			NotEmpty().
			Default("v1"),
		field.String("status").
			Default("queued"),
		field.Int("attempt_count").
			Default(0),
		field.Int("priority").
			Default(0),
		field.Time("requested_at").
			Default(time.Now),
		field.Time("started_at").
			Optional().
			Nillable(),
		field.Time("finished_at").
			Optional().
			Nillable(),
		field.Time("next_retry_at").
			Default(time.Now),
		field.String("last_error").
			Optional().
			Nillable(),
		field.JSON("quality_report_json", map[string]any{}).
			Optional(),
		field.JSON("summary_json", map[string]any{}).
			Optional(),
		field.JSON("analysis_phase_json", map[string]any{}).
			Optional(),
		field.JSON("analysis_events_json", map[string]any{}).
			Optional(),
		field.JSON("analysis_timeseries_json", map[string]any{}).
			Optional(),
		field.String("artifact_result_dir").
			Optional().
			Nillable(),
		field.JSON("artifact_manifest_json", map[string]any{}).
			Optional(),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the GameAnalysis.
func (GameAnalysis) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("game", Game.Type).
			Ref("analysis").
			Field("game_id").
			Unique().
			Required(),
	}
}

// Indexes of the GameAnalysis.
func (GameAnalysis) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("game_id").
			Unique(),
		index.Fields("status", "next_retry_at", "priority", "requested_at"),
	}
}
