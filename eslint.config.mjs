import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    ignores: ["src/_stash/**"],
  },
];
