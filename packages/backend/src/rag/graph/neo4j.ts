import neo4j, { type Driver } from "neo4j-driver";
import { isGraphConfigured, ragConfig } from "../config.js";

let driver: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (!isGraphConfigured()) {
    throw new Error("Neo4j is not configured (NEO4J_URI / USER / PASSWORD)");
  }
    if (!driver) {
    driver = neo4j.driver(
      ragConfig.neo4jUri,
      neo4j.auth.basic(ragConfig.neo4jUser, ragConfig.neo4jPassword),
      {
        connectionTimeout: 5000,
        connectionAcquisitionTimeout: 5000,
      },
    );
  }
  return driver;
}

export async function pingNeo4j(): Promise<boolean> {
  if (!isGraphConfigured()) return false;
  try {
    await getNeo4jDriver().verifyConnectivity();
    return true;
  } catch {
    return false;
  }
}

export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
