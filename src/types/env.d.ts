declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: string;
      JWT_SECRET: string;
      JWT_EXPIRES_IN: string;
      CORS_ORIGIN: string;
      NODE_ENV: "development" | "production";
    }
  }
}

export {};