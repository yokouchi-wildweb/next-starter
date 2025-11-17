export type KeyValuePair = {
  key: string;
  value: string | null;
};

export type ServiceAccountDetails = {
  raw: string | null;
  parsed: KeyValuePair[] | null;
  parseError?: string;
};

export type EnvSummary = {
  serviceAccount: ServiceAccountDetails;
  firebaseEnvVars: KeyValuePair[];
  otherEnvVars: KeyValuePair[];
};

export type EnvApiError = {
  section: string;
  message: string;
  detail?: string;
};

export type EnvApiResponse = {
  data: EnvSummary;
  errors: EnvApiError[];
};

const toKeyValuePair = (key: string, value: string | undefined): KeyValuePair => ({
  key,
  value: value ?? null,
});

const sortByKey = (entries: KeyValuePair[]): KeyValuePair[] =>
  [...entries].sort((a, b) => a.key.localeCompare(b.key));

const buildFirebaseEnvList = (env: NodeJS.ProcessEnv): KeyValuePair[] =>
  sortByKey(
    Object.entries(env)
      .filter(([key]) => key.includes("FIREBASE"))
      .map(([key, value]) => toKeyValuePair(key, value))
  );

const buildOtherEnvList = (env: NodeJS.ProcessEnv): KeyValuePair[] =>
  [
    "APP_ENV",
    "NODE_ENV",
    "MY_TEST_VALUE",
    "NEXT_PUBLIC_MY_TEST_VALUE",
    "MY_YAML_VALUE",
    "MY_SECRET",
  ].map((key) =>
    toKeyValuePair(key, env[key])
  );

const parseServiceAccountKey = (
  rawValue: string | undefined
): { details: ServiceAccountDetails; errors: EnvApiError[] } => {
  const errors: EnvApiError[] = [];
  const raw = rawValue ?? null;
  let parsed: KeyValuePair[] | null = null;
  let parseError: string | undefined;

  if (raw) {
    try {
      const parsedJson = JSON.parse(raw);
      if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
        parsed = sortByKey(
          Object.entries(parsedJson).map(([key, value]) => ({
            key,
            value:
              value === null || value === undefined
                ? null
                : typeof value === "string"
                ? value
                : JSON.stringify(value),
          }))
        );
      } else {
        parseError = "JSON オブジェクトとして解釈できませんでした。";
        errors.push({
          section: "MY_SERVICE_ACCOUNT_KEY",
          message: "サービスアカウントキーの形式が不正です。",
          detail: parseError,
        });
      }
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
      errors.push({
        section: "MY_SERVICE_ACCOUNT_KEY",
        message: "サービスアカウントキーのパースに失敗しました。",
        detail: parseError,
      });
    }
  }

  return {
    details: {
      raw,
      parsed,
      parseError,
    },
    errors,
  };
};

export const createEmptySummary = (): EnvSummary => ({
  serviceAccount: {
    raw: null,
    parsed: null,
  },
  firebaseEnvVars: [],
  otherEnvVars: [
    { key: "APP_ENV", value: null },
    { key: "NODE_ENV", value: null },
    { key: "MY_TEST_VALUE", value: null },
    { key: "NEXT_PUBLIC_MY_TEST_VALUE", value: null },
    { key: "MY_YAML_VALUE", value: null },
    { key: "MY_SECRET", value: null },
  ],
});

export const buildEnvSummary = (): EnvApiResponse => {
  const env = process.env;
  const firebaseEnvVars = buildFirebaseEnvList(env);
  const otherEnvVars = buildOtherEnvList(env);
  const { details: serviceAccount, errors: serviceAccountErrors } = parseServiceAccountKey(
    env.MY_SERVICE_ACCOUNT_KEY
  );

  return {
    data: {
      serviceAccount,
      firebaseEnvVars,
      otherEnvVars,
    },
    errors: serviceAccountErrors,
  };
};
