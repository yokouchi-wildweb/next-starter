import { businessConfig } from "@/config/business.config";
import type { VariableMap } from "@/lib/structuredDocument";

/**
 * ドキュメント内で使用する変数マップ
 * {{VARIABLE_NAME}} 形式のプレースホルダーを置換する
 */
export const documentVariables: VariableMap = {
  SERVICE_NAME: businessConfig.serviceName,
  COMPANY_NAME: businessConfig.company.name,
  DOMAIN: businessConfig.domain,
  EMAIL: businessConfig.company.email,
};
