package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Player holds the schema definition for the Player entity.
type Player struct {
	ent.Schema
}

// Fields of the Player.
func (Player) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			NotEmpty(),
		field.String("race").
			NotEmpty().
			Comment("Zerg/Terran/Protoss"),
		field.Uint8("team"),
		field.String("color").
			Optional(),
		field.Uint8("player_id").
			Comment("Player.ID from replay"),
		field.Int32("apm").
			Optional(),
		field.Int32("eapm").
			Optional(),
		field.Uint32("cmd_count").
			Optional(),
		field.Uint32("effective_cmd_count").
			Optional(),
		field.Uint16("start_location_x").
			Optional(),
		field.Uint16("start_location_y").
			Optional(),
		field.Int32("start_direction").
			Optional().
			Comment("1-12 clock direction"),
		field.Int("redundancy").
			Optional().
			Comment("Redundancy percentage"),
		field.Bool("is_winner").
			Default(false),
		field.Bool("is_random_selected").
			Default(false).
			StructTag(`json:"is_random_selected"`).
			Comment("Whether this player selected Random before the replay resolved an actual race"),
		field.String("result").
			Default("unknown").
			Comment("win/loss/draw/unknown"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
	}
}

// Edges of the Player.
func (Player) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("game", Game.Type).
			Ref("players").
			Unique().
			Required(),
	}
}

// Indexes of the Player.
func (Player) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("name"),
		index.Edges("game"),
		index.Fields("player_id").
			Edges("game").
			Unique(),
	}
}
