import { businessConfig } from "@/config/business.config";
import type { LegalSection } from "@/lib/structuredDocument/legal";
import type { LegalDocument } from "@/lib/structuredDocument/legal";

/**
 * 許認可セクション（該当する場合のみ）
 */
const licensesSection: LegalSection | null =
  businessConfig.legal.licenses.length > 0
    ? {
        id: "licenses",
        title: "関連法令に基づく許認可",
        content: businessConfig.legal.licenses.flatMap((license) => [
          `**${license.label}**`,
          ...license.details.map((d) =>
            d.key ? `${d.key}: ${d.value}` : d.value
          ),
        ]),
      }
    : null;

/**
 * 特定商取引法に基づく表示
 */
export const tradelawConfig: LegalDocument = {
  title: "特定商取引法に基づく表示",
  sectionNumbering: "numeric",
  sections: [
    // 商品の販売価格・サービスの対価
    {
      id: "price",
      title: "商品の販売価格・サービスの対価",
      content: [
        "各商品のご購入ページにて表示する価格",
      ],
      children: [
        {
          content: [
            "※特別な販売条件または提供条件がある商品またはサービスについては、各商品またはサービスの購入ページにおいて条件を表示します。",
          ],
        },
      ],
    },

    // 対価以外に必要となる費用
    {
      id: "additional-cost",
      title: "上記対価以外に必要となる費用",
      content: [
        "インターネット接続料金その他の電気通信回線の通信に関する費用はお客様にて別途ご用意いただく必要があります（金額は、お客様が契約した各事業者が定める通り）。",
      ],
    },

    // 支払方法
    {
      id: "payment-method",
      title: "支払方法",
      content: ["{{PAYMENT_METHODS}}"],
    },

    // 代金の支払時期
    {
      id: "payment-timing",
      title: "代金の支払時期",
      content: [
        "上記の支払方法を提供する決済会社の定めや、ご利用のクレジットカードの締め日や契約内容により異なります。決済会社や、ご利用されるカード会社までお問い合わせください。",
      ],
    },

    // 商品引渡しまたはサービス提供の時期
    {
      id: "delivery-timing",
      title: "商品引渡しまたはサービス提供の時期",
      content: [
        "デジタルコンテンツについては、決済後ただちに提供します。",
        "配送を伴う商品については、原則として10日以内に発送いたします。",
      ],
      children: [
        {
          content: ["※商品により異なる場合は、各商品ページに記載します。"],
        },
      ],
    },

    // 送料
    {
      id: "shipping",
      title: "送料",
      content: [
        "配送を伴う商品の送料は、原則として無料です。別途送料が発生する場合には、各商品のご購入ページにて表示します。",
      ],
    },

    // 返品・キャンセルに関する特約
    {
      id: "return-policy",
      title: "返品・キャンセルに関する特約",
      content: [
        "デジタルコンテンツの性質上、購入後の返品・キャンセル・払い戻しはお受けいたしかねます。",
        "配送を伴う商品については、発送手続完了後の返品やキャンセルはお受けいたしかねます。",
        "商品の品違い、汚損や破損がある場合は、当社に故意又は重過失がある場合にのみ、返金または交換等の対応をいたします。",
      ],
      children: [
        {
          content: ["※詳細は[利用規約](/terms)に定めるものとします。"],
        },
      ],
    },

    // 販売数量の制限
    {
      id: "quantity-limit",
      title: "販売数量の制限",
      content: [
        "各商品の販売数量に制限が設けられている場合、個別のご購入ページに表示します。",
      ],
    },

    // 許認可情報（条件付き）
    ...(licensesSection ? [licensesSection] : []),

    // 事業者の名称・住所・連絡先
    {
      id: "business-info",
      title: "事業者の名称・住所・連絡先",
      content: [
        "{{POSTAL_CODE}}",
        "{{ADDRESS}}",
        "{{COMPANY_NAME}}",
        "{{REPRESENTATIVE}}",
        "電話番号：{{PHONE}}",
        "メールアドレス：{{EMAIL}}",
      ],
    },
  ],
};
