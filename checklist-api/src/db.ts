import pg from "pg";
export function connectDb() {
  if (!process.env.DATABASE_URL)
    throw new Error("請設定 DATABASE_URL；公開查詢不需要資料庫連線");
  return new pg.Client({ connectionString: process.env.DATABASE_URL });
}
