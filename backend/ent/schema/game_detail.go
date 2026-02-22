package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// GameDetail holds the schema definition for the GameDetail entity.
type GameDetail struct {
	ent.Schema
}

// Fields of the GameDetail.
func (GameDetail) Fields() []ent.Field {
	return []ent.Field{
		field.JSON("apm_timeline", []PlayerAPMTimeline{}).
			Optional().
			Comment("Per-player APM timeline data"),
		field.JSON("build_orders", []PlayerBuildOrder{}).
			Optional().
			Comment("Per-player raw command events"),
		field.JSON("compressed_build_orders", []PlayerBuildOrder{}).
			Optional().
			Comment("Per-player compressed meaningful build orders"),
		field.JSON("chat_messages", []ChatMessage{}).
			Optional().
			Comment("In-game chat messages"),
	}
}

// Edges of the GameDetail.
func (GameDetail) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("game", Game.Type).
			Ref("game_detail").
			Unique().
			Required(),
	}
}
