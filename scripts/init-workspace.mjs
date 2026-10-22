import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL을 안전한 환경변수로 설정해 주세요.')
const sql = neon(process.env.DATABASE_URL)
await sql`CREATE TABLE IF NOT EXISTS cjeng_order_workspace (
  id integer PRIMARY KEY CHECK (id = 1),
  orders jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
)`
await sql`INSERT INTO cjeng_order_workspace (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
console.log('공유 수주대장 테이블 준비 완료. 기존 데이터는 변경하지 않았습니다.')
