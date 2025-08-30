CREATE TABLE "users" (
  "id" uuid PRIMARY KEY,
  "email" varchar(32) UNIQUE,
  "username" varchar(32) UNIQUE,
  "status" varchar(16) NOT NULL DEFAULT 'ACTIVE',
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "auth_credentials" (
  "user_id" uuid PRIMARY KEY,
  "password_hash" text NOT NULL,
  "password_algo" varchar(16) NOT NULL DEFAULT 'argon2id',
  "password_params" jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "token_hash" char(64) UNIQUE NOT NULL,
  "issued_at" timestamptz NOT NULL DEFAULT (now()),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "revoked_reason" varchar(64),
  "fingerprint" varchar(128),
  "ip" inet,
  "user_agent" text
);

CREATE TABLE "jwt_blocklist" (
  "jti" char(36) PRIMARY KEY,
  "user_id" uuid,
  "expires_at" timestamptz NOT NULL,
  "reason" varchar(64)
);

CREATE TABLE "project" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid,
  "project_name" char(64),
  "format" char(64) DEFAULT 'dsj',
  "max_scene" int,
  "max_speed" float,
  "max_accel" float,
  "min_separation" float,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

CREATE TABLE "project_scenes" (
  "scene_id" uuid,
  "project_id" uuid,
  PRIMARY KEY ("scene_id", "project_id")
);

CREATE TABLE "scene" (
  "id" uuid PRIMARY KEY,
  "s3_key" VARCHAR(1024),
  "scene_num" int
);

CREATE INDEX ON "refresh_tokens" ("user_id");

CREATE INDEX ON "refresh_tokens" ("expires_at");

ALTER TABLE "auth_credentials" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "jwt_blocklist" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "project" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "project_scenes" ADD FOREIGN KEY ("scene_id") REFERENCES "scene" ("id");

ALTER TABLE "project_scenes" ADD FOREIGN KEY ("project_id") REFERENCES "project" ("id");