package services

import (
	"math"
	"testing"
)

func TestConversions(t *testing.T) {
	tests := []struct {
		name    string
		convert func(Measurement) (float64, error)
		in      Measurement
		want    float64
		wantErr bool
	}{
		{"kg stays kg", ToKg, Measurement{80, "kg"}, 80, false},
		{"1 lb is exactly 0.45359237 kg", ToKg, Measurement{1, "lb"}, 0.45359237, false},
		{"225 lb", ToKg, Measurement{225, "lb"}, 102.05828325, false},
		{"unknown weight unit", ToKg, Measurement{80, "stone"}, 0, true},
		{"cm stays cm", ToCm, Measurement{180, "cm"}, 180, false},
		{"1 in is exactly 2.54 cm", ToCm, Measurement{1, "in"}, 2.54, false},
		{"5 ft 10 in = 70 in", ToCm, Measurement{70, "in"}, 177.8, false},
		{"unknown height unit", ToCm, Measurement{70, "ft"}, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.convert(tt.in)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
			if math.Abs(got-tt.want) > 1e-9 {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}
