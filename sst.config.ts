/// <reference path="./.sst/platform/config.d.ts" />

/**
 * NoteShare — backend SST v3 (Ion). Région eu-west-3 (Paris).
 * Le frontend Next.js est déployé séparément sur Netlify : SST ne gère
 * ici que l'API (API Gateway + Lambda) et le stockage S3 des images.
 */
export default $config({
  app(input) {
    return {
      name: "noteshare",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage ?? ""),
      home: "aws",
      providers: { aws: { region: "eu-west-3" } },
    };
  },
  async run() {
    // Secrets : `sst secret set MongoUri "..."` etc.
    const mongoUri = new sst.Secret("MongoUri");
    const jwtSecret = new sst.Secret("JwtSecret");
    const corsOrigins = new sst.Secret("CorsOrigins", "*");

    // Bucket images — lecture publique (URLs servies dans les cards/modals).
    const bucket = new sst.aws.Bucket("Uploads", { access: "public" });

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: false, // CORS géré dans Hono
    });

    api.route("$default", {
      handler: "packages/backend/src/index.handler",
      runtime: "nodejs20.x",
      nodejs: { format: "esm" },
      timeout: "29 seconds",
      memory: "512 MB",
      link: [bucket],
      environment: {
        MONGODB_URI: mongoUri.value,
        MONGODB_DB: "noteshare",
        JWT_SECRET: jwtSecret.value,
        BUCKET_NAME: bucket.name,
        CORS_ORIGINS: corsOrigins.value,
      },
    });

    return {
      api: api.url,
      bucket: bucket.name,
    };
  },
});
