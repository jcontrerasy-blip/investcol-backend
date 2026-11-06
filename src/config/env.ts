import dotenv from "dotenv";

dotenv.config();

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;

  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${key}`);
  }

  return value;
}

export const env = {
  port: Number(getEnvVar("PORT", "4000")),
  jwtSecret: getEnvVar("JWT_SECRET"),
  jwtExpiresIn: getEnvVar("JWT_EXPIRES_IN", "1d"),
  corsOrigin: getEnvVar("CORS_ORIGIN", "*"),
  nodeEnv: getEnvVar("NODE_ENV", "development"),
};