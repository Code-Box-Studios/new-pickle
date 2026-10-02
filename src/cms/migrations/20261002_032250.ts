import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE SCHEMA IF NOT EXISTS "cms";
   CREATE TYPE "cms"."enum_homepage_steps_icon" AS ENUM('map', 'calendar', 'trophy', 'shield', 'chart');
  CREATE TYPE "cms"."enum_homepage_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__homepage_v_version_steps_icon" AS ENUM('map', 'calendar', 'trophy', 'shield', 'chart');
  CREATE TYPE "cms"."enum__homepage_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_site_settings_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__site_settings_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_venue_landing_benefits_icon" AS ENUM('map', 'calendar', 'trophy', 'shield', 'chart');
  CREATE TYPE "cms"."enum_venue_landing_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__venue_landing_v_version_benefits_icon" AS ENUM('map', 'calendar', 'trophy', 'shield', 'chart');
  CREATE TYPE "cms"."enum__venue_landing_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "cms"."cms_users" (
    "id" serial PRIMARY KEY NOT NULL,
    "email" varchar NOT NULL,
    "external_user_id" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "cms"."payload_kv" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "data" jsonb NOT NULL
  );

  CREATE TABLE "cms"."payload_locked_documents" (
    "id" serial PRIMARY KEY NOT NULL,
    "global_slug" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "cms"."payload_locked_documents_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "cms_users_id" integer
  );

  CREATE TABLE "cms"."payload_preferences" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar,
    "value" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "cms"."payload_preferences_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "cms_users_id" integer
  );

  CREATE TABLE "cms"."payload_migrations" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar,
    "batch" numeric,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "cms"."homepage_steps" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "title" varchar,
    "body" varchar,
    "icon" "cms"."enum_homepage_steps_icon"
  );

  CREATE TABLE "cms"."homepage" (
    "id" serial PRIMARY KEY NOT NULL,
    "hero_eyebrow" varchar DEFAULT 'Pickleball courts for everyone',
    "hero_title" varchar DEFAULT 'Find your',
    "hero_accent" varchar DEFAULT 'next game.',
    "hero_description" varchar DEFAULT 'Search real-time court availability across independent venues. Reserve in seconds, pay the venue, and play.',
    "primary_label" varchar DEFAULT 'Find a court',
    "primary_href" varchar DEFAULT '#find-courts',
    "secondary_label" varchar DEFAULT 'List your venue',
    "secondary_href" varchar DEFAULT '/list-your-venue',
    "availability_label" varchar DEFAULT 'Live availability',
    "payment_label" varchar DEFAULT 'Pay the venue directly',
    "popular_eyebrow" varchar DEFAULT 'Find your court',
    "popular_title" varchar DEFAULT 'Popular venues',
    "popular_description" varchar DEFAULT 'Highly rated courts near you.',
    "explore_label" varchar DEFAULT 'Explore all courts',
    "steps_eyebrow" varchar DEFAULT 'Less planning. More playing.',
    "steps_title" varchar DEFAULT 'A good game is three steps away.',
    "steps_description" varchar DEFAULT 'From finding your court to your first serve. Here''s how RallyPoint works.',
    "owner_eyebrow" varchar DEFAULT 'For venue owners',
    "owner_title" varchar DEFAULT 'More players. Fuller courts.',
    "owner_description" varchar DEFAULT 'List your venue, manage reservations, and receive payments directly.',
    "owner_label" varchar DEFAULT 'List your venue',
    "owner_href" varchar DEFAULT '/list-your-venue',
    "_status" "cms"."enum_homepage_status" DEFAULT 'draft',
    "updated_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone
  );

  CREATE TABLE "cms"."_homepage_v_version_steps" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar,
    "body" varchar,
    "icon" "cms"."enum__homepage_v_version_steps_icon",
    "_uuid" varchar
  );

  CREATE TABLE "cms"."_homepage_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "version_hero_eyebrow" varchar DEFAULT 'Pickleball courts for everyone',
    "version_hero_title" varchar DEFAULT 'Find your',
    "version_hero_accent" varchar DEFAULT 'next game.',
    "version_hero_description" varchar DEFAULT 'Search real-time court availability across independent venues. Reserve in seconds, pay the venue, and play.',
    "version_primary_label" varchar DEFAULT 'Find a court',
    "version_primary_href" varchar DEFAULT '#find-courts',
    "version_secondary_label" varchar DEFAULT 'List your venue',
    "version_secondary_href" varchar DEFAULT '/list-your-venue',
    "version_availability_label" varchar DEFAULT 'Live availability',
    "version_payment_label" varchar DEFAULT 'Pay the venue directly',
    "version_popular_eyebrow" varchar DEFAULT 'Find your court',
    "version_popular_title" varchar DEFAULT 'Popular venues',
    "version_popular_description" varchar DEFAULT 'Highly rated courts near you.',
    "version_explore_label" varchar DEFAULT 'Explore all courts',
    "version_steps_eyebrow" varchar DEFAULT 'Less planning. More playing.',
    "version_steps_title" varchar DEFAULT 'A good game is three steps away.',
    "version_steps_description" varchar DEFAULT 'From finding your court to your first serve. Here''s how RallyPoint works.',
    "version_owner_eyebrow" varchar DEFAULT 'For venue owners',
    "version_owner_title" varchar DEFAULT 'More players. Fuller courts.',
    "version_owner_description" varchar DEFAULT 'List your venue, manage reservations, and receive payments directly.',
    "version_owner_label" varchar DEFAULT 'List your venue',
    "version_owner_href" varchar DEFAULT '/list-your-venue',
    "version__status" "cms"."enum__homepage_v_version_status" DEFAULT 'draft',
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "cms"."site_settings_footer_links" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "label" varchar,
    "href" varchar
  );

  CREATE TABLE "cms"."site_settings" (
    "id" serial PRIMARY KEY NOT NULL,
    "header_tagline" varchar DEFAULT 'Pickleball, made simple.',
    "home_label" varchar DEFAULT 'Home',
    "explore_label" varchar DEFAULT 'Explore',
    "bookings_label" varchar DEFAULT 'My bookings',
    "venue_label" varchar DEFAULT 'For venues',
    "search_label" varchar DEFAULT 'Find courts',
    "sign_in_label" varchar DEFAULT 'Sign in',
    "footer_description" varchar DEFAULT 'Payment goes directly to the venue. The venue confirms your reservation. RallyPoint makes discovery and booking easier.',
    "footer_tagline" varchar DEFAULT 'A little less planning. A lot more playing.',
    "studio_name" varchar DEFAULT 'Code Box Studios',
    "_status" "cms"."enum_site_settings_status" DEFAULT 'draft',
    "updated_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone
  );

  CREATE TABLE "cms"."_site_settings_v_version_footer_links" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "label" varchar,
    "href" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "cms"."_site_settings_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "version_header_tagline" varchar DEFAULT 'Pickleball, made simple.',
    "version_home_label" varchar DEFAULT 'Home',
    "version_explore_label" varchar DEFAULT 'Explore',
    "version_bookings_label" varchar DEFAULT 'My bookings',
    "version_venue_label" varchar DEFAULT 'For venues',
    "version_search_label" varchar DEFAULT 'Find courts',
    "version_sign_in_label" varchar DEFAULT 'Sign in',
    "version_footer_description" varchar DEFAULT 'Payment goes directly to the venue. The venue confirms your reservation. RallyPoint makes discovery and booking easier.',
    "version_footer_tagline" varchar DEFAULT 'A little less planning. A lot more playing.',
    "version_studio_name" varchar DEFAULT 'Code Box Studios',
    "version__status" "cms"."enum__site_settings_v_version_status" DEFAULT 'draft',
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "cms"."venue_landing_benefits" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "title" varchar,
    "body" varchar,
    "icon" "cms"."enum_venue_landing_benefits_icon"
  );

  CREATE TABLE "cms"."venue_landing" (
    "id" serial PRIMARY KEY NOT NULL,
    "eyebrow" varchar DEFAULT 'For venue owners',
    "title" varchar DEFAULT 'Fill your courts with more players.',
    "description" varchar DEFAULT 'List your venue on RallyPoint, take online reservations, and get paid directly — you stay in control of your courts.',
    "create_label" varchar DEFAULT 'Create your venue',
    "sign_in_label" varchar DEFAULT 'Get started',
    "_status" "cms"."enum_venue_landing_status" DEFAULT 'draft',
    "updated_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone
  );

  CREATE TABLE "cms"."_venue_landing_v_version_benefits" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar,
    "body" varchar,
    "icon" "cms"."enum__venue_landing_v_version_benefits_icon",
    "_uuid" varchar
  );

  CREATE TABLE "cms"."_venue_landing_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "version_eyebrow" varchar DEFAULT 'For venue owners',
    "version_title" varchar DEFAULT 'Fill your courts with more players.',
    "version_description" varchar DEFAULT 'List your venue on RallyPoint, take online reservations, and get paid directly — you stay in control of your courts.',
    "version_create_label" varchar DEFAULT 'Create your venue',
    "version_sign_in_label" varchar DEFAULT 'Get started',
    "version__status" "cms"."enum__venue_landing_v_version_status" DEFAULT 'draft',
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "cms"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "cms"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."homepage_steps" ADD CONSTRAINT "homepage_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_homepage_v_version_steps" ADD CONSTRAINT "_homepage_v_version_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_homepage_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."site_settings_footer_links" ADD CONSTRAINT "site_settings_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_site_settings_v_version_footer_links" ADD CONSTRAINT "_site_settings_v_version_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_site_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."venue_landing_benefits" ADD CONSTRAINT "venue_landing_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."venue_landing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_venue_landing_v_version_benefits" ADD CONSTRAINT "_venue_landing_v_version_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_venue_landing_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "cms_users_external_user_id_idx" ON "cms"."cms_users" USING btree ("external_user_id");
  CREATE INDEX "cms_users_updated_at_idx" ON "cms"."cms_users" USING btree ("updated_at");
  CREATE INDEX "cms_users_created_at_idx" ON "cms"."cms_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "cms"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "cms"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "cms"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "cms"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "cms"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "cms"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "cms"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_cms_users_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "cms"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "cms"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "cms"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "cms"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "cms"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "cms"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_cms_users_id_idx" ON "cms"."payload_preferences_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "cms"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "cms"."payload_migrations" USING btree ("created_at");
  CREATE INDEX "homepage_steps_order_idx" ON "cms"."homepage_steps" USING btree ("_order");
  CREATE INDEX "homepage_steps_parent_id_idx" ON "cms"."homepage_steps" USING btree ("_parent_id");
  CREATE INDEX "homepage__status_idx" ON "cms"."homepage" USING btree ("_status");
  CREATE INDEX "_homepage_v_version_steps_order_idx" ON "cms"."_homepage_v_version_steps" USING btree ("_order");
  CREATE INDEX "_homepage_v_version_steps_parent_id_idx" ON "cms"."_homepage_v_version_steps" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_version_version__status_idx" ON "cms"."_homepage_v" USING btree ("version__status");
  CREATE INDEX "_homepage_v_created_at_idx" ON "cms"."_homepage_v" USING btree ("created_at");
  CREATE INDEX "_homepage_v_updated_at_idx" ON "cms"."_homepage_v" USING btree ("updated_at");
  CREATE INDEX "_homepage_v_latest_idx" ON "cms"."_homepage_v" USING btree ("latest");
  CREATE INDEX "site_settings_footer_links_order_idx" ON "cms"."site_settings_footer_links" USING btree ("_order");
  CREATE INDEX "site_settings_footer_links_parent_id_idx" ON "cms"."site_settings_footer_links" USING btree ("_parent_id");
  CREATE INDEX "site_settings__status_idx" ON "cms"."site_settings" USING btree ("_status");
  CREATE INDEX "_site_settings_v_version_footer_links_order_idx" ON "cms"."_site_settings_v_version_footer_links" USING btree ("_order");
  CREATE INDEX "_site_settings_v_version_footer_links_parent_id_idx" ON "cms"."_site_settings_v_version_footer_links" USING btree ("_parent_id");
  CREATE INDEX "_site_settings_v_version_version__status_idx" ON "cms"."_site_settings_v" USING btree ("version__status");
  CREATE INDEX "_site_settings_v_created_at_idx" ON "cms"."_site_settings_v" USING btree ("created_at");
  CREATE INDEX "_site_settings_v_updated_at_idx" ON "cms"."_site_settings_v" USING btree ("updated_at");
  CREATE INDEX "_site_settings_v_latest_idx" ON "cms"."_site_settings_v" USING btree ("latest");
  CREATE INDEX "venue_landing_benefits_order_idx" ON "cms"."venue_landing_benefits" USING btree ("_order");
  CREATE INDEX "venue_landing_benefits_parent_id_idx" ON "cms"."venue_landing_benefits" USING btree ("_parent_id");
  CREATE INDEX "venue_landing__status_idx" ON "cms"."venue_landing" USING btree ("_status");
  CREATE INDEX "_venue_landing_v_version_benefits_order_idx" ON "cms"."_venue_landing_v_version_benefits" USING btree ("_order");
  CREATE INDEX "_venue_landing_v_version_benefits_parent_id_idx" ON "cms"."_venue_landing_v_version_benefits" USING btree ("_parent_id");
  CREATE INDEX "_venue_landing_v_version_version__status_idx" ON "cms"."_venue_landing_v" USING btree ("version__status");
  CREATE INDEX "_venue_landing_v_created_at_idx" ON "cms"."_venue_landing_v" USING btree ("created_at");
  CREATE INDEX "_venue_landing_v_updated_at_idx" ON "cms"."_venue_landing_v" USING btree ("updated_at");
  CREATE INDEX "_venue_landing_v_latest_idx" ON "cms"."_venue_landing_v" USING btree ("latest");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cms"."cms_users" CASCADE;
  DROP TABLE "cms"."payload_kv" CASCADE;
  DROP TABLE "cms"."payload_locked_documents" CASCADE;
  DROP TABLE "cms"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "cms"."payload_preferences" CASCADE;
  DROP TABLE "cms"."payload_preferences_rels" CASCADE;
  DROP TABLE "cms"."payload_migrations" CASCADE;
  DROP TABLE "cms"."homepage_steps" CASCADE;
  DROP TABLE "cms"."homepage" CASCADE;
  DROP TABLE "cms"."_homepage_v_version_steps" CASCADE;
  DROP TABLE "cms"."_homepage_v" CASCADE;
  DROP TABLE "cms"."site_settings_footer_links" CASCADE;
  DROP TABLE "cms"."site_settings" CASCADE;
  DROP TABLE "cms"."_site_settings_v_version_footer_links" CASCADE;
  DROP TABLE "cms"."_site_settings_v" CASCADE;
  DROP TABLE "cms"."venue_landing_benefits" CASCADE;
  DROP TABLE "cms"."venue_landing" CASCADE;
  DROP TABLE "cms"."_venue_landing_v_version_benefits" CASCADE;
  DROP TABLE "cms"."_venue_landing_v" CASCADE;
  DROP TYPE "cms"."enum_homepage_steps_icon";
  DROP TYPE "cms"."enum_homepage_status";
  DROP TYPE "cms"."enum__homepage_v_version_steps_icon";
  DROP TYPE "cms"."enum__homepage_v_version_status";
  DROP TYPE "cms"."enum_site_settings_status";
  DROP TYPE "cms"."enum__site_settings_v_version_status";
  DROP TYPE "cms"."enum_venue_landing_benefits_icon";
  DROP TYPE "cms"."enum_venue_landing_status";
  DROP TYPE "cms"."enum__venue_landing_v_version_benefits_icon";
  DROP TYPE "cms"."enum__venue_landing_v_version_status";`)
}
