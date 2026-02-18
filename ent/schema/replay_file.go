package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// ReplayFile holds the schema definition for the ReplayFile entity.
type ReplayFile struct {
	ent.Schema
}

// Fields of the ReplayFile.
func (ReplayFile) Fields() []ent.Field {
	return []ent.Field{
		field.String("file_hash").
			NotEmpty().
			Comment("SHA256 hash"),
		field.String("filename").
			NotEmpty().
			Comment("Original filename"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
	}
}

// Edges of the ReplayFile.
func (ReplayFile) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("game", Game.Type).
			Ref("replay_files").
			Unique().
			Required(),
		edge.From("uploader", User.Type).
			Ref("uploaded_replay_files").
			Unique().
			Required(),
	}
}

// Indexes of the ReplayFile.
func (ReplayFile) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("file_hash"),
		index.Edges("game", "uploader").
			Unique(),
	}
}
