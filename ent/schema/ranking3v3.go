package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Ranking3v3 holds precomputed ranking snapshot rows for 3v3.
type Ranking3v3 struct {
	ent.Schema
}

func (Ranking3v3) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "ranking_3v3"},
	}
}

func (Ranking3v3) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").NotEmpty(),
		field.Int("rank").Default(0),
		field.Int("games").Default(0),
		field.Int("wins").Default(0),
		field.Int("losses").Default(0),
		field.Int("draws").Default(0),
		field.Float("win_rate").Default(0),
		field.Float("avg_apm").Default(0),
		field.Float("avg_eapm").Default(0),
		field.Int("min_games").Default(20).Comment("minimum games threshold used for this snapshot"),
		field.Time("computed_at").Default(time.Now),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Ranking3v3) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("name").Unique(),
		index.Fields("rank"),
		index.Fields("games"),
		index.Fields("win_rate"),
		index.Fields("avg_apm"),
		index.Fields("avg_eapm"),
	}
}
