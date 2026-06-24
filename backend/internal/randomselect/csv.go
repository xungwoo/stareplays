package randomselect

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
)

type GameRecord struct {
	SeasonLabel            string
	SeasonNo               int
	RowNumber              int
	PlayerRandomSelections []bool
}

func ParseCSV(r io.Reader) ([]GameRecord, error) {
	reader := csv.NewReader(r)
	reader.FieldsPerRecord = -1

	var records []GameRecord
	seasonLabel := ""
	seasonNo := 0
	rowNumber := 0

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read csv row %d: %w", rowNumber+1, err)
		}
		rowNumber++
		trimBOM(row)

		if label, no, ok := seasonFromRow(row); ok {
			seasonLabel = label
			seasonNo = no
			continue
		}
		if seasonLabel == "" || !isGameRow(row) {
			continue
		}

		playerRandomSelections := playerRandomSelectionsFromRow(row, IsForcedRandomSeasonNo(seasonNo))
		records = append(records, GameRecord{
			SeasonLabel:            seasonLabel,
			SeasonNo:               seasonNo,
			RowNumber:              rowNumber,
			PlayerRandomSelections: playerRandomSelections,
		})
	}

	return records, nil
}

func IsForcedRandomSeasonNo(seasonNo int) bool {
	return seasonNo == 7 || seasonNo == 8
}

func IsForcedRandomSeasonLabel(label string) bool {
	_, no, ok := seasonFromRow([]string{strings.TrimSpace(label)})
	return ok && IsForcedRandomSeasonNo(no)
}

func BySeason(records []GameRecord) map[string][]GameRecord {
	grouped := make(map[string][]GameRecord)
	for _, record := range records {
		grouped[record.SeasonLabel] = append(grouped[record.SeasonLabel], record)
	}
	return grouped
}

func trimBOM(row []string) {
	if len(row) > 0 {
		row[0] = strings.TrimPrefix(row[0], "\ufeff")
	}
}

func seasonFromRow(row []string) (string, int, bool) {
	for _, cell := range row {
		value := strings.TrimSpace(cell)
		if !strings.HasPrefix(value, "시즌") {
			continue
		}
		rawNo := strings.TrimPrefix(value, "시즌")
		no, err := strconv.Atoi(rawNo)
		if err != nil || no <= 0 {
			continue
		}
		return fmt.Sprintf("시즌%d", no), no, true
	}
	return "", 0, false
}

func isGameRow(row []string) bool {
	count := 0
	for _, index := range []int{1, 2, 3, 6, 7, 8} {
		if index < len(row) && isRaceCell(row[index]) {
			count++
		}
	}
	return count >= 6
}

func isRaceCell(value string) bool {
	value = strings.TrimSpace(value)
	return strings.Contains(value, "프") ||
		strings.Contains(value, "테") ||
		strings.Contains(value, "저") ||
		strings.Contains(value, "랜")
}

func playerRandomSelectionsFromRow(row []string, forcedRandom bool) []bool {
	selections := make([]bool, 0, 6)
	for _, index := range []int{1, 2, 3, 6, 7, 8} {
		selections = append(selections, forcedRandom || (index < len(row) && strings.Contains(strings.TrimSpace(row[index]), "랜")))
	}
	return selections
}
