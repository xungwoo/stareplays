package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

// AppSetting stores small API-controlled runtime settings.
type AppSetting struct {
	ent.Schema
}

// Fields of the AppSetting.
func (AppSetting) Fields() []ent.Field {
	return []ent.Field{
		field.String("key").
			NotEmpty().
			Unique(),
		field.String("value").
			Optional(),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}
