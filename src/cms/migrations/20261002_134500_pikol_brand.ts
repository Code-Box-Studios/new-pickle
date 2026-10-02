import { type MigrateUpArgs, type MigrateDownArgs, sql } from "@payloadcms/db-postgres";

// Rename copy in published content, drafts, and saved versions without reseeding
// or changing links, document identities, or publication status.
function renameCopy(from: "RallyPoint" | "Pikol", to: "RallyPoint" | "Pikol") {
  return sql.raw(`
    DO $$
    DECLARE field RECORD;
    BEGIN
      FOR field IN
        SELECT table_name, column_name, column_default
        FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name IN (
            'homepage', 'homepage_steps', '_homepage_v', '_homepage_v_version_steps',
            'site_settings', 'site_settings_footer_links',
            '_site_settings_v', '_site_settings_v_version_footer_links',
            'venue_landing', 'venue_landing_benefits',
            '_venue_landing_v', '_venue_landing_v_version_benefits'
          )
          AND data_type IN ('character varying', 'text')
          AND column_name NOT IN ('id', '_uuid', 'href', 'version_href')
          AND column_name NOT LIKE '%_href'
      LOOP
        EXECUTE format(
          'UPDATE cms.%I SET %I = replace(%I, %L, %L) WHERE strpos(%I, %L) > 0',
          field.table_name, field.column_name, field.column_name,
          '${from}', '${to}', field.column_name, '${from}'
        );
        IF strpos(field.column_default, '${from}') > 0 THEN
          EXECUTE format(
            'ALTER TABLE cms.%I ALTER COLUMN %I SET DEFAULT %s',
            field.table_name, field.column_name,
            replace(field.column_default, '${from}', '${to}')
          );
        END IF;
      END LOOP;
    END $$;
  `);
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(renameCopy("RallyPoint", "Pikol"));
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(renameCopy("Pikol", "RallyPoint"));
}
