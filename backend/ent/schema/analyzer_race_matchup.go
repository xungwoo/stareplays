package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// AnalyzerRaceMatchup stores precomputed race composition matchup snapshots.
type AnalyzerRaceMatchup struct {
	ent.Schema
}

func (AnalyzerRaceMatchup) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "analyzer_race_matchups"},
	}
}

func (AnalyzerRaceMatchup) Fields() []ent.Field {
	return []ent.Field{
		field.Int("team_size").Default(0),
		field.String("team_a").NotEmpty(),
		field.String("team_b").NotEmpty(),
		field.String("matchup_key").NotEmpty(),
		field.Int("games").Default(0),
		field.Int("team_a_wins").Default(0),
		field.Int("team_b_wins").Default(0),
		field.Float("team_a_win_rate").Default(0),
		field.Float("team_b_win_rate").Default(0),
		field.Time("computed_at").Default(time.Now),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AnalyzerRaceMatchup) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("team_size", "team_a", "team_b").Unique(),
		index.Fields("team_size", "games"),
		index.Fields("team_size", "team_a_win_rate"),
		index.Fields("team_size", "matchup_key"),
	}
}
