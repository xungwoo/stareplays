package randomselect

import (
	"strings"
	"testing"
)

func TestParseCSVDetectsRandomMarkersAndForcesSeasonSevenEight(t *testing.T) {
	input := strings.Join([]string{
		"시즌2,,,,,,,,,",
		"12/06,랜(프),랜(저),랜(테),승,,프,프,저,",
		"12/06,프,프,테,승,,프,프,저,",
		"시즌7,,,,,,,,,",
		"06/01,프,프,테,승,,프,프,저,",
		"시즌8,,,,,,,,,",
		"06/22,테,저,프,승,,프,테,저,",
	}, "\n")

	records, err := ParseCSV(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseCSV returned error: %v", err)
	}
	if len(records) != 4 {
		t.Fatalf("len(records) = %d, want 4", len(records))
	}

	if !records[0].IsRandomSelected {
		t.Fatalf("season2 row with 랜 marker was not marked random")
	}
	if records[1].IsRandomSelected {
		t.Fatalf("season2 fixed-race row was marked random")
	}
	if !records[2].IsRandomSelected {
		t.Fatalf("season7 row should be forced random")
	}
	if !records[3].IsRandomSelected {
		t.Fatalf("season8 row should be forced random")
	}
}

func TestBySeasonPreservesSeasonOrder(t *testing.T) {
	records := []GameRecord{
		{SeasonLabel: "시즌1", RowNumber: 3},
		{SeasonLabel: "시즌1", RowNumber: 4},
		{SeasonLabel: "시즌2", RowNumber: 8},
	}

	grouped := BySeason(records)

	if got := grouped["시즌1"][1].RowNumber; got != 4 {
		t.Fatalf("second 시즌1 RowNumber = %d, want 4", got)
	}
}

func TestForcedRandomSeasonLabel(t *testing.T) {
	if IsForcedRandomSeasonLabel("시즌6") {
		t.Fatalf("season6 should not be forced random")
	}
	if !IsForcedRandomSeasonLabel("시즌7") {
		t.Fatalf("season7 should be forced random")
	}
	if !IsForcedRandomSeasonLabel("시즌8") {
		t.Fatalf("season8 should be forced random")
	}
}
