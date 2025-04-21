import { Pool, PoolClient } from "pg";
import { DbConfig } from "./types";

export class DbService {
  private config: DbConfig;
  private pool: Pool | null = null;
  private queries: Record<string, string> = {
    getAllStores: "SELECT * FROM shopify_shops",
    getAllUsers: "SELECT * FROM users",
  };

  constructor(config: DbConfig) {
    this.config = config;
  }

  /**
   * Initialize database connection pool
   */
  async init(): Promise<void> {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      ssl: { rejectUnauthorized: false },
    });

    try {
      // Test the connection
      const client = await this.pool.connect();
      client.release();
      console.log("✅ Database connection successful");
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw error;
    }
  }

  /**
   * Execute a registered query with the provided parameters
   */
  async executeQuery<T>(queryName: string): Promise<T[]> {
    if (!this.pool) {
      await this.init();
    }

    const query = this.queries[queryName];

    let client: PoolClient | null = null;
    try {
      client = await this.pool!.connect();
      const result = await client.query(query);
      return result.rows as T[];
    } catch (error) {
      console.error(`Error executing query "${queryName}":`, error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {}
}
