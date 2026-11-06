package services

import "fmt"

// Exact conversion constants (by definition, not rounded). The frontend's lib/units.ts uses
// the same numbers; both have tests. Go is the only place that converts what users type
// (D23): the API takes {value, unit} and everything is stored in kg, cm and seconds.
const (
	kgPerLb = 0.45359237
	cmPerIn = 2.54
)

// Measurement is a number the user typed, with the unit they typed it in.
type Measurement struct {
	Value float64 `json:"value"`
	Unit  string  `json:"unit"`
}

// ToKg converts a weight in "kg" or "lb" to kg.
func ToKg(m Measurement) (float64, error) {
	switch m.Unit {
	case "kg":
		return m.Value, nil
	case "lb":
		return m.Value * kgPerLb, nil
	}
	return 0, fmt.Errorf("unknown weight unit %q", m.Unit)
}

// ToCm converts a length in "cm" or "in" to cm (the frontend sends feet + inches as inches).
func ToCm(m Measurement) (float64, error) {
	switch m.Unit {
	case "cm":
		return m.Value, nil
	case "in":
		return m.Value * cmPerIn, nil
	}
	return 0, fmt.Errorf("unknown height unit %q", m.Unit)
}
