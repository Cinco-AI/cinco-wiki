/** Accès centralisé aux variables d'environnement / secrets SST. */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

export const env = {
  get mongoUri() {
    return required("MONGODB_URI");
  },
  get dbName() {
    return process.env.MONGODB_DB ?? "noteshare";
  },
  get jwtSecret() {
    return required("JWT_SECRET");
  },
  get bucket() {
    return required("BUCKET_NAME");
  },
  get region() {
    return process.env.AWS_REGION ?? "eu-west-3";
  },
  /** Origine(s) frontend autorisée(s) pour CORS, séparées par des virgules. */
  get corsOrigins() {
    return (process.env.CORS_ORIGINS ?? "*").split(",").map((s) => s.trim());
  },
};
