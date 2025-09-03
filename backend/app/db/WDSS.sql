CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
-- CREATE TABLE IF NOT EXISTS scene_payload (
--   scene_id uuid PRIMARY KEY,
--   drones   jsonb,
--   preview  text,
--   updated_at timestamptz DEFAULT now(),
--   CONSTRAINT fk_scene_payload_scene
--     FOREIGN KEY (scene_id) REFERENCES scene(id) ON DELETE CASCADE
-- );

CREATE INDEX ON "refresh_tokens" ("user_id");

CREATE INDEX ON "refresh_tokens" ("expires_at");

ALTER TABLE "auth_credentials" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "jwt_blocklist" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "project" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "project_scenes" ADD FOREIGN KEY ("scene_id") REFERENCES "scene" ("id");

ALTER TABLE "project_scenes" ADD FOREIGN KEY ("project_id") REFERENCES "project" ("id");

-- 2. updated_at 자동 갱신을 위한 공용 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW(); -- NEW는 UPDATE 될 행의 새로운 버전을 의미합니다.
   RETURN NEW;
END;
$$ language 'plpgsql';


-- 3. 각 테이블의 컬럼에 기본값(DEFAULT) 설정
-- users 테이블
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- refresh_tokens 테이블
ALTER TABLE "refresh_tokens" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- project 테이블
ALTER TABLE "project" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "project" ALTER COLUMN "created_at" SET DEFAULT NOW();
ALTER TABLE "project" ALTER COLUMN "updated_at" SET DEFAULT NOW();

-- scene 테이블
ALTER TABLE "scene" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();


-- 4. updated_at 자동 갱신 트리거 적용
-- users 테이블에 트리거 적용
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- auth_credentials 테이블에 트리거 적용
CREATE TRIGGER set_timestamp_auth_credentials
BEFORE UPDATE ON "auth_credentials"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- project 테이블에 트리거 적용
CREATE TRIGGER set_timestamp_project
BEFORE UPDATE ON "project"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
