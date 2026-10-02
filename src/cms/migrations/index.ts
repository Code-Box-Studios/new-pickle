import * as migration_20261002_032250 from './20261002_032250';
import * as migration_20261002_134500_pikol_brand from './20261002_134500_pikol_brand';

export const migrations = [
  {
    up: migration_20261002_032250.up,
    down: migration_20261002_032250.down,
    name: '20261002_032250'
  },
  {
    up: migration_20261002_134500_pikol_brand.up,
    down: migration_20261002_134500_pikol_brand.down,
    name: '20261002_134500_pikol_brand'
  },
];
