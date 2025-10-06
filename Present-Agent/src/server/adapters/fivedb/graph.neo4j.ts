import { GraphStore } from "../../types.js";
import neo4j from "neo4j-driver";

export class Neo4jGraph implements GraphStore {
  private driver: any;
  private database?: string;

  constructor(url: string, user: string, password: string, database?: string) {
    this.driver = neo4j.driver(url, neo4j.auth.basic(user, password));
    this.database = database;
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async upsertRelationshipGraph(payload: Record<string, unknown>): Promise<void> {
    // Minimal contract:
    // { recipientId: string, likes?: { categories?: string[], vendors?: string[] } }
    const recipientId = String((payload as any).recipientId || "");
    if (!recipientId) return;
    const likes = (payload as any).likes || {};
    const categories: string[] = Array.isArray(likes.categories) ? likes.categories : [];
    const vendors: string[] = Array.isArray(likes.vendors) ? likes.vendors : [];
    const session = this.driver.session({ database: this.database });
    try {
      const tx = session.beginTransaction();
      await tx.run(
        `MERGE (r:Recipient {id: $rid}) ON CREATE SET r.createdAt = timestamp()`,
        { rid: recipientId }
      );
      for (const c of categories) {
        await tx.run(
          `MERGE (r:Recipient {id: $rid})
           MERGE (c:Category {name: $c})
           MERGE (r)-[:LIKES]->(c)`,
          { rid: recipientId, c }
        );
      }
      for (const v of vendors) {
        await tx.run(
          `MERGE (r:Recipient {id: $rid})
           MERGE (v:Vendor {name: $v})
           MERGE (r)-[:LIKES]->(v)`,
          { rid: recipientId, v }
        );
      }
      await tx.commit();
    } finally {
      await session.close();
    }
  }

  async getPreferredCategories(recipientId: string): Promise<string[]> {
    const session = this.driver.session({ database: this.database });
    try {
      const res = await session.run(
        `MATCH (:Recipient {id: $rid})-[:LIKES]->(c:Category)
         RETURN c.name AS name`,
        { rid: recipientId }
      );
      return res.records.map((r: any) => String(r.get("name")));
    } finally {
      await session.close();
    }
  }
}
