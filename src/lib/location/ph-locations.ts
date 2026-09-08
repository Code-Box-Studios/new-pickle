export const OTHER = "Other" as const;

export interface CityLocations {
  city: string;
  barangays: string[];
}

// Canonical city strings MUST byte-match stored/searched values (search is exact-equality).
// Barangays are a curated real subset (source: PSGC / PhilAtlas); "Other" covers the rest.
export const PH_LOCATIONS: CityLocations[] = [
  {
    city: "Davao City",
    barangays: [
      "Agdao", "Buhangin", "Toril", "Talomo Proper", "Ma-a", "Bucana",
      "Sasa", "Panacan", "Matina Aplaya", "Matina Crossing", "Matina Pangi",
      "Catalunan Grande", "Catalunan Pequeño", "Bago Aplaya", "Bago Gallera",
      "Dumoy", "Mintal", "Cabantian", "Communal", "Tigatto", "Mandug",
      "Waan", "Tibungco", "Ilang", "Vicente Hizon Sr.", "Bunawan Proper",
      "Calinan", "Baguio",
    ],
  },
  {
    city: "Tagum City",
    barangays: [
      "Apokon", "Bincungan", "Busaon", "Canocotan", "Cuambogan", "La Filipina",
      "Liboganon", "Madaum", "Magdum", "Magugpo East", "Magugpo North",
      "Magugpo Poblacion", "Magugpo South", "Magugpo West", "Mankilam",
      "New Balamban", "Nueva Fuerza", "Pagsabangan", "Pandapan", "San Agustin",
      "San Isidro", "San Miguel", "Visayan Village",
    ],
  },
];

export function cityNames(): string[] {
  return PH_LOCATIONS.map((l) => l.city);
}

export function barangaysForCity(city: string): string[] {
  return PH_LOCATIONS.find((l) => l.city === city)?.barangays ?? [];
}
