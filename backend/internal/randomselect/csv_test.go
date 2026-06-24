package randomselect

import (
	"strings"
	"testing"
)

func TestParseCSVDetectsPlayerRandomSelectionsAndForcesSeasonSevenEight(t *testing.T) {
	input := strings.Join([]string{
		"시즌2,,,,,,,,,",
		"12/06,랜(프),랜(저),랜(테),승,,프,프,저,",
		"12/06,랜(프),랜(저),랜(테),승,,랜(프),랜(프),랜(저),",
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
	if len(records) != 5 {
		t.Fatalf("len(records) = %d, want 5", len(records))
	}

	wantPartial := []bool{true, true, true, false, false, false}
	if got := records[0].PlayerRandomSelections; !equalBools(got, wantPartial) {
		t.Fatalf("partial row PlayerRandomSelections = %v, want %v", got, wantPartial)
	}

	wantAll := []bool{true, true, true, true, true, true}
	if got := records[1].PlayerRandomSelections; !equalBools(got, wantAll) {
		t.Fatalf("all-random row PlayerRandomSelections = %v, want %v", got, wantAll)
	}

	wantFixed := []bool{false, false, false, false, false, false}
	if got := records[2].PlayerRandomSelections; !equalBools(got, wantFixed) {
		t.Fatalf("fixed row PlayerRandomSelections = %v, want %v", got, wantFixed)
	}
	if got := records[3].PlayerRandomSelections; !equalBools(got, wantAll) {
		t.Fatalf("season7 row PlayerRandomSelections = %v, want %v", got, wantAll)
	}
	if got := records[4].PlayerRandomSelections; !equalBools(got, wantAll) {
		t.Fatalf("season8 row PlayerRandomSelections = %v, want %v", got, wantAll)
	}
}

func equalBools(left []bool, right []bool) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
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
