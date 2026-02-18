package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// User holds the schema definition for the User entity.
type User struct {
	ent.Schema
}

// Fields of the User.
func (User) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			NotEmpty().
			Unique(),
		field.Int("total_games").
			Default(0),
		field.Int("wins").
			Default(0),
		field.Int("losses").
			Default(0),
		field.Int("draws").
			Default(0),
		field.Float("average_apm").
			Default(0),
		field.Float("average_eapm").
			Default(0),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the User.
func (User) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("uploaded_replay_files", ReplayFile.Type),
	}
}
