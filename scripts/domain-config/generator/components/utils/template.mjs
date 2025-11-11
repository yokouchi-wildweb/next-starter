import fs from "fs";
import path from "path";

const templateDir = path.join(process.cwd(), "src", "features", "_template", "components");
const partialDir = path.join(templateDir, "_partial");

const partialCache = {};

function replaceTokens(content, tokens) {
  const safeLabel = tokens.label ?? tokens.pascal;
  const safeKebab = tokens.kebab ?? tokens.camel;
  const safeKebabPlural = tokens.kebabPlural ?? tokens.camelPlural;

  return content
    .replace(/__domain__/g, tokens.camel)
    .replace(/__Domain__/g, tokens.pascal)
    .replace(/__domains__/g, tokens.camelPlural)
    .replace(/__Domains__/g, tokens.pascalPlural)
    .replace(/__domainSlug__/gi, safeKebab)
    .replace(/__domainsSlug__/gi, safeKebabPlural)
    .replace(/__domainLabel__/gi, safeLabel);
}

function getPartial(name) {
  if (!partialCache[name]) {
    const filePath = path.join(partialDir, name);
    if (!fs.existsSync(filePath)) {
      console.error(`Partial template not found: ${filePath}`);
      process.exit(1);
    }
    partialCache[name] = fs.readFileSync(filePath, "utf8");
  }
  return partialCache[name];
}

function replacePartialTokens(template, tokens) {
  return template
    .replace(/__fieldName__/g, tokens.fieldName)
    .replace(/__label__/g, tokens.label)
    .replace(/__optionsName__/g, tokens.optionsName ?? "")
    .replace(/__options__/g, tokens.options ?? "")
    .replace(/__name__/g, tokens.name ?? "")
    .replace(/__uploadPath__/g, tokens.uploadPath ?? "")
    .replace(/__uploadHandler__/g, tokens.uploadHandler ?? "")
    .replace(/__deleteHandler__/g, tokens.deleteHandler ?? "")
    .replace(/__markDeletedHandler__/g, tokens.markDeletedHandler ?? "");
}

export { templateDir, partialDir, replaceTokens, getPartial, replacePartialTokens };
