import { resolveFeatureTemplatePath } from "../../utils/pathHelpers.mjs";

const templateDir = resolveFeatureTemplatePath("hooks");

function replaceTokens(content, tokens) {
  return content
    .replace(/__domain__/g, tokens.camel)
    .replace(/__Domain__/g, tokens.pascal)
    .replace(/__domains__/g, tokens.camelPlural)
    .replace(/__Domains__/g, tokens.pascalPlural);
}

export { templateDir, replaceTokens };
