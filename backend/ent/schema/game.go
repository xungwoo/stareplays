package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Game holds the schema definition for the Game entity.
type Game struct {
	ent.Schema
}

// Fields of the Game.
func (Game) Fields() []ent.Field {
	return []ent.Field{
		field.String("host").
			NotEmpty().
			Comment("Header.Host (game creator)"),
		field.Time("start_time").
			Comment("Header.StartTime"),
		field.String("map_name").
			Optional(),
		field.Uint16("map_width").
			Optional(),
		field.Uint16("map_height").
			Optional(),
		field.Int("game_length").
			Optional().
			Comment("Game duration in seconds"),
		field.String("game_type").
			Optional().
			Comment("Header.Type.Name"),
		field.String("game_speed").
			Optional().
			Comment("Header.Speed.Name"),
		field.String("title").
			Optional().
			Comment("Header.Title"),
		field.Int("player_count").
			Default(0).
			Comment("Number of non-observer players"),
		field.Int("upload_count").
			Default(1).
			Comment("Number of uploaded replay files (reliability)"),
		field.Uint8("winner_team").
			Default(0).
			Comment("Computed.WinnerTeam"),
		field.String("season_label").
			Optional().
			Nillable().
			Comment("Season label used by team analysis, e.g. 시즌1"),
		field.Int("season_no").
			Optional().
			Nillable().
			Comment("Numeric season number used for ordering"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the Game.
func (Game) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("players", Player.Type),
		edge.To("replay_files", ReplayFile.Type),
		edge.To("game_detail", GameDetail.Type).
			Unique(),
		edge.To("analysis", GameAnalysis.Type).
			Unique(),
	}
}

// Indexes of the Game.
func (Game) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("host", "start_time").
			Unique(),
		index.Fields("player_count"),
		index.Fields("season_label", "start_time", "created_at"),
	}
}
