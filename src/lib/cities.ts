import catalog from "@/lib/data/philippine-cities.json";

export interface CityOption {
  value: string;
  name: string;
  province?: string;
  code?: string;
}

export const PHILIPPINE_CITIES: CityOption[] = catalog.cities;
export const DEFAULT_CITY = "Davao City";
