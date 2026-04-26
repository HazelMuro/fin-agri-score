/**
 * Zimbabwe district climatology reference data.
 *
 * For each major farming district we hold:
 *   - approximate geographic centroid (lat/lon)
 *   - agro-ecological zone (Natural Region I..V, where I is wettest and V is driest)
 *   - climatological rainfall baselines (mm) for a typical wet-season 30-day and 90-day window
 *   - NDVI baseline (0..1) and typical intra-season variability
 *
 * Sources: Zimbabwe's Natural Regions framework (Vincent & Thomas 1960 and subsequent
 * updates), FAO GIEWS country profiles, and AGRITEX agro-ecological zoning. Values are
 * rounded to realistic demo precision and act as a resilient fallback when a live
 * satellite API call fails or is unreachable.
 *
 * NR-I   (wettest): > 1000 mm/year, specialised/diversified farming   -> NDVI ~0.70
 * NR-II  (wet):     750-1000 mm, intensive farming                    -> NDVI ~0.60
 * NR-III (middle):  650-800 mm,  semi-intensive                       -> NDVI ~0.48
 * NR-IV (semi-arid): 450-650 mm, semi-extensive                       -> NDVI ~0.35
 * NR-V  (dry):      < 450 mm,    extensive ranching                   -> NDVI ~0.25
 *
 * 90-day climatology is a mid-season window (Jan-Feb main rains).
 * 30-day climatology is a representative peak-month slice.
 */

const DISTRICTS = [
  { province: 'Manicaland',          district: 'Mutasa',       lat: -18.25, lon:  32.70, zone: 'I',   rain90: 520, rain30: 190, ndvi: 0.72, ndviVar: 0.09 },
  { province: 'Manicaland',          district: 'Chimanimani',  lat: -19.80, lon:  32.87, zone: 'I',   rain90: 530, rain30: 195, ndvi: 0.70, ndviVar: 0.10 },
  { province: 'Manicaland',          district: 'Nyanga',       lat: -18.22, lon:  32.74, zone: 'I',   rain90: 560, rain30: 210, ndvi: 0.74, ndviVar: 0.09 },
  { province: 'Manicaland',          district: 'Mutare',       lat: -18.97, lon:  32.67, zone: 'II',  rain90: 430, rain30: 155, ndvi: 0.62, ndviVar: 0.10 },
  { province: 'Manicaland',          district: 'Makoni',       lat: -18.25, lon:  32.10, zone: 'II',  rain90: 410, rain30: 150, ndvi: 0.60, ndviVar: 0.10 },
  { province: 'Manicaland',          district: 'Buhera',       lat: -19.30, lon:  31.43, zone: 'IV',  rain90: 250, rain30:  95, ndvi: 0.36, ndviVar: 0.11 },
  { province: 'Manicaland',          district: 'Chipinge',     lat: -20.20, lon:  32.62, zone: 'II',  rain90: 400, rain30: 145, ndvi: 0.58, ndviVar: 0.11 },

  { province: 'Mashonaland East',    district: 'Murehwa',      lat: -17.65, lon:  31.79, zone: 'II',  rain90: 450, rain30: 165, ndvi: 0.63, ndviVar: 0.09 },
  { province: 'Mashonaland East',    district: 'Marondera',    lat: -18.19, lon:  31.55, zone: 'II',  rain90: 440, rain30: 160, ndvi: 0.61, ndviVar: 0.09 },
  { province: 'Mashonaland East',    district: 'Goromonzi',    lat: -17.87, lon:  31.33, zone: 'II',  rain90: 455, rain30: 165, ndvi: 0.62, ndviVar: 0.09 },
  { province: 'Mashonaland East',    district: 'Mudzi',        lat: -16.93, lon:  32.60, zone: 'III', rain90: 340, rain30: 125, ndvi: 0.47, ndviVar: 0.11 },
  { province: 'Mashonaland East',    district: 'Uzumba',       lat: -17.10, lon:  32.10, zone: 'III', rain90: 360, rain30: 130, ndvi: 0.49, ndviVar: 0.10 },
  { province: 'Mashonaland East',    district: 'Mutoko',       lat: -17.42, lon:  32.22, zone: 'III', rain90: 370, rain30: 135, ndvi: 0.50, ndviVar: 0.10 },
  { province: 'Mashonaland East',    district: 'Seke',         lat: -17.92, lon:  31.07, zone: 'II',  rain90: 435, rain30: 160, ndvi: 0.60, ndviVar: 0.09 },
  { province: 'Mashonaland East',    district: 'Chikomba',     lat: -18.63, lon:  31.13, zone: 'III', rain90: 345, rain30: 125, ndvi: 0.48, ndviVar: 0.10 },

  { province: 'Mashonaland Central', district: 'Bindura',      lat: -17.30, lon:  31.33, zone: 'II',  rain90: 440, rain30: 160, ndvi: 0.62, ndviVar: 0.09 },
  { province: 'Mashonaland Central', district: 'Shamva',       lat: -17.31, lon:  31.57, zone: 'II',  rain90: 425, rain30: 155, ndvi: 0.60, ndviVar: 0.09 },
  { province: 'Mashonaland Central', district: 'Mazowe',       lat: -17.52, lon:  30.97, zone: 'II',  rain90: 455, rain30: 165, ndvi: 0.63, ndviVar: 0.09 },
  { province: 'Mashonaland Central', district: 'Guruve',       lat: -16.65, lon:  30.70, zone: 'III', rain90: 360, rain30: 130, ndvi: 0.50, ndviVar: 0.10 },
  { province: 'Mashonaland Central', district: 'Mbire',        lat: -16.15, lon:  30.65, zone: 'IV',  rain90: 270, rain30: 100, ndvi: 0.38, ndviVar: 0.12 },
  { province: 'Mashonaland Central', district: 'Muzarabani',   lat: -16.38, lon:  31.02, zone: 'IV',  rain90: 260, rain30:  95, ndvi: 0.36, ndviVar: 0.12 },
  { province: 'Mashonaland Central', district: 'Rushinga',     lat: -16.70, lon:  31.57, zone: 'III', rain90: 330, rain30: 120, ndvi: 0.46, ndviVar: 0.11 },

  { province: 'Mashonaland West',    district: 'Chegutu',      lat: -18.13, lon:  30.15, zone: 'II',  rain90: 430, rain30: 155, ndvi: 0.60, ndviVar: 0.09 },
  { province: 'Mashonaland West',    district: 'Kadoma',       lat: -18.33, lon:  29.92, zone: 'III', rain90: 365, rain30: 130, ndvi: 0.51, ndviVar: 0.10 },
  { province: 'Mashonaland West',    district: 'Makonde',      lat: -17.25, lon:  30.05, zone: 'II',  rain90: 440, rain30: 160, ndvi: 0.61, ndviVar: 0.09 },
  { province: 'Mashonaland West',    district: 'Hurungwe',     lat: -16.75, lon:  29.80, zone: 'III', rain90: 370, rain30: 135, ndvi: 0.52, ndviVar: 0.10 },
  { province: 'Mashonaland West',    district: 'Zvimba',       lat: -17.60, lon:  30.25, zone: 'II',  rain90: 445, rain30: 160, ndvi: 0.62, ndviVar: 0.09 },
  { province: 'Mashonaland West',    district: 'Sanyati',      lat: -17.67, lon:  29.22, zone: 'III', rain90: 340, rain30: 125, ndvi: 0.47, ndviVar: 0.11 },
  { province: 'Mashonaland West',    district: 'Mhondoro',     lat: -18.30, lon:  30.60, zone: 'III', rain90: 360, rain30: 130, ndvi: 0.50, ndviVar: 0.10 },
  { province: 'Mashonaland West',    district: 'Kariba',       lat: -16.52, lon:  28.80, zone: 'IV',  rain90: 260, rain30:  95, ndvi: 0.35, ndviVar: 0.12 },

  { province: 'Midlands',            district: 'Gweru',        lat: -19.45, lon:  29.82, zone: 'III', rain90: 340, rain30: 125, ndvi: 0.47, ndviVar: 0.10 },
  { province: 'Midlands',            district: 'Kwekwe',       lat: -18.93, lon:  29.82, zone: 'III', rain90: 350, rain30: 130, ndvi: 0.49, ndviVar: 0.10 },
  { province: 'Midlands',            district: 'Shurugwi',     lat: -19.67, lon:  30.00, zone: 'III', rain90: 355, rain30: 130, ndvi: 0.49, ndviVar: 0.10 },
  { province: 'Midlands',            district: 'Gokwe South',  lat: -18.22, lon:  28.93, zone: 'III', rain90: 330, rain30: 120, ndvi: 0.46, ndviVar: 0.11 },
  { province: 'Midlands',            district: 'Gokwe North',  lat: -17.70, lon:  28.80, zone: 'IV',  rain90: 275, rain30: 100, ndvi: 0.39, ndviVar: 0.12 },
  { province: 'Midlands',            district: 'Zvishavane',   lat: -20.33, lon:  30.03, zone: 'IV',  rain90: 250, rain30:  95, ndvi: 0.34, ndviVar: 0.12 },
  { province: 'Midlands',            district: 'Mberengwa',    lat: -20.48, lon:  29.93, zone: 'IV',  rain90: 260, rain30:  95, ndvi: 0.36, ndviVar: 0.11 },
  { province: 'Midlands',            district: 'Chirumhanzu',  lat: -19.83, lon:  30.30, zone: 'III', rain90: 335, rain30: 120, ndvi: 0.46, ndviVar: 0.10 },

  { province: 'Masvingo',            district: 'Masvingo',     lat: -20.07, lon:  30.83, zone: 'IV',  rain90: 270, rain30: 100, ndvi: 0.37, ndviVar: 0.11 },
  { province: 'Masvingo',            district: 'Bikita',       lat: -19.97, lon:  31.43, zone: 'IV',  rain90: 280, rain30: 105, ndvi: 0.39, ndviVar: 0.11 },
  { province: 'Masvingo',            district: 'Chiredzi',     lat: -21.05, lon:  31.67, zone: 'V',   rain90: 190, rain30:  70, ndvi: 0.26, ndviVar: 0.13 },
  { province: 'Masvingo',            district: 'Gutu',         lat: -19.63, lon:  31.15, zone: 'IV',  rain90: 285, rain30: 105, ndvi: 0.40, ndviVar: 0.11 },
  { province: 'Masvingo',            district: 'Mwenezi',      lat: -21.32, lon:  30.73, zone: 'V',   rain90: 200, rain30:  75, ndvi: 0.27, ndviVar: 0.13 },
  { province: 'Masvingo',            district: 'Zaka',         lat: -20.33, lon:  31.47, zone: 'IV',  rain90: 275, rain30: 100, ndvi: 0.38, ndviVar: 0.11 },
  { province: 'Masvingo',            district: 'Chivi',        lat: -20.30, lon:  30.90, zone: 'V',   rain90: 220, rain30:  80, ndvi: 0.30, ndviVar: 0.12 },

  { province: 'Matabeleland North',  district: 'Lupane',       lat: -18.93, lon:  27.80, zone: 'IV',  rain90: 250, rain30:  95, ndvi: 0.34, ndviVar: 0.12 },
  { province: 'Matabeleland North',  district: 'Hwange',       lat: -18.37, lon:  26.50, zone: 'IV',  rain90: 260, rain30: 100, ndvi: 0.36, ndviVar: 0.12 },
  { province: 'Matabeleland North',  district: 'Nkayi',        lat: -19.00, lon:  28.90, zone: 'IV',  rain90: 245, rain30:  90, ndvi: 0.33, ndviVar: 0.12 },
  { province: 'Matabeleland North',  district: 'Binga',        lat: -17.62, lon:  27.34, zone: 'V',   rain90: 180, rain30:  65, ndvi: 0.25, ndviVar: 0.13 },
  { province: 'Matabeleland North',  district: 'Bubi',         lat: -19.47, lon:  28.70, zone: 'IV',  rain90: 255, rain30:  95, ndvi: 0.35, ndviVar: 0.12 },
  { province: 'Matabeleland North',  district: 'Tsholotsho',   lat: -19.80, lon:  27.73, zone: 'IV',  rain90: 230, rain30:  85, ndvi: 0.32, ndviVar: 0.12 },
  { province: 'Matabeleland North',  district: 'Umguza',       lat: -19.90, lon:  28.60, zone: 'IV',  rain90: 255, rain30:  95, ndvi: 0.35, ndviVar: 0.12 },

  { province: 'Matabeleland South',  district: 'Gwanda',       lat: -20.93, lon:  29.00, zone: 'V',   rain90: 190, rain30:  70, ndvi: 0.26, ndviVar: 0.13 },
  { province: 'Matabeleland South',  district: 'Beitbridge',   lat: -22.22, lon:  30.00, zone: 'V',   rain90: 160, rain30:  60, ndvi: 0.22, ndviVar: 0.14 },
  { province: 'Matabeleland South',  district: 'Bulilima',     lat: -20.35, lon:  27.80, zone: 'IV',  rain90: 235, rain30:  85, ndvi: 0.32, ndviVar: 0.12 },
  { province: 'Matabeleland South',  district: 'Mangwe',       lat: -20.67, lon:  27.83, zone: 'IV',  rain90: 225, rain30:  85, ndvi: 0.31, ndviVar: 0.12 },
  { province: 'Matabeleland South',  district: 'Matobo',       lat: -20.70, lon:  28.50, zone: 'IV',  rain90: 250, rain30:  90, ndvi: 0.34, ndviVar: 0.12 },
  { province: 'Matabeleland South',  district: 'Umzingwane',   lat: -20.42, lon:  28.95, zone: 'IV',  rain90: 245, rain30:  90, ndvi: 0.33, ndviVar: 0.12 },
  { province: 'Matabeleland South',  district: 'Insiza',       lat: -19.75, lon:  29.15, zone: 'IV',  rain90: 255, rain30:  95, ndvi: 0.35, ndviVar: 0.12 },

  { province: 'Harare',              district: 'Harare',       lat: -17.83, lon:  31.05, zone: 'II',  rain90: 440, rain30: 160, ndvi: 0.55, ndviVar: 0.10 },
  { province: 'Bulawayo',            district: 'Bulawayo',     lat: -20.15, lon:  28.58, zone: 'IV',  rain90: 240, rain30:  90, ndvi: 0.30, ndviVar: 0.12 },
];

module.exports = { DISTRICTS };
