import { businessConfig } from "@/config/business.config";
import type { VariableMap } from "@/lib/structuredDocument";

/**
 * ドキュメント内で使用する変数マップ
 * {{VARIABLE_NAME}} 形式のプレースホルダーを置換する
 */
export const documentVariables: VariableMap = {
  // サービス情報
  SERVICE_NAME: businessConfig.serviceName,
  DOMAIN: businessConfig.domain,

  // 会社情報
  COMPANY_NAME: businessConfig.company.name,
  REPRESENTATIVE: businessConfig.company.representative,
  POSTAL_CODE: businessConfig.company.postalCode,
  ADDRESS: businessConfig.company.address,
  PHONE: businessConfig.company.phone,
  EMAIL: businessConfig.company.email,

  // 決済情報
  PAYMENT_METHODS: businessConfig.payment.methods,
};
