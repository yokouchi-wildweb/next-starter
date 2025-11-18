import Image from "next/image";
import { Zen_Kaku_Gothic_New } from "next/font/google";

import { Main } from "@/components/TextBlocks";

import styles from "./page.module.css";

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
});

const ASSETS = {
  calendar: "https://www.figma.com/api/mcp/asset/18097410-df2c-4a8f-aef2-3ce2253f6f14",
  ellipse: "https://www.figma.com/api/mcp/asset/082878f5-9a69-47db-81e0-ad9186f4ffac",
  photoA: "https://www.figma.com/api/mcp/asset/e7df90c8-0929-46f1-b5fd-0c69957d1288",
  photoB: "https://www.figma.com/api/mcp/asset/55719075-c166-4c93-9f1e-b22919b560ad",
  photoC: "https://www.figma.com/api/mcp/asset/57aa06ab-4c80-4d3f-9204-48b647cbe02a",
  photoD: "https://www.figma.com/api/mcp/asset/16f977e4-aef9-4025-aef8-2e3bddb85475",
};

const REGIONS = [
  "全て",
  "北海道・東北",
  "関東",
  "中部",
  "関西",
  "中国",
  "四国",
  "九州・沖縄",
  "海外",
  "その他",
] as const;

const CATEGORIES = ["カテゴリーA", "カテゴリーB", "カテゴリーC", "カテゴリーD"] as const;

const SCHEDULES = [
  { id: "today", label: "本日開催", detail: "2025/3/11 (火)", highlight: true },
  { id: "week", label: "今週開催", detail: "2025/3/8 (土) 〜 2025/3/14 (日)" },
  { id: "month", label: "今月開催" },
  { id: "next", label: "来月開催" },
] as const;

const EVENT_CARDS = [
  {
    id: "event-a",
    image: ASSETS.photoA,
    region: "関東",
    category: "カテゴリーC",
    date: "2025/3/15",
    title: "タイトルが表示されます。あああああああああああ",
    body: "文章が表示されます。あああああああああああああ。あああああああああああ。あああああああああああああ.....",
    organization: "企業名や団体名がここに入ります",
  },
  {
    id: "event-b",
    image: ASSETS.photoB,
    region: "九州・沖縄",
    category: "カテゴリーC",
    date: "2025/3/15",
    title: "タイトルが表示されます。あああああああああああ",
    body: "文章が表示されます。あああああああああああああ。あああああああああああ。あああああああああああああ.....",
    organization: "企業名や団体名がここに入ります",
  },
  {
    id: "event-c",
    image: ASSETS.photoC,
    region: "その他",
    category: "カテゴリーD",
    date: "2025/3/15",
    title: "タイトルが表示されます。あああああああああああ",
    body: "文章が表示されます。あああああああああああああ。あああああああああああ。あああああああああああああ.....",
    organization: "企業名や団体名がここに入ります",
  },
  {
    id: "event-d",
    image: ASSETS.photoD,
    region: "北海道・東北",
    category: "カテゴリーA",
    date: "2025/3/15",
    title: "タイトルが表示されます。あああああああああああ",
    body: "文章が表示されます。あああああああああああああ。あああああああああああ。あああああああああああああ.....",
    organization: "企業名や団体名がここに入ります",
  },
] as const;

const EXPANDED_EVENTS = [...EVENT_CARDS, ...EVENT_CARDS];

export default function VoranowaEventSectionDemo() {
  return (
    <Main
      containerType="plain"
      padding="none"
      className={`${styles.page} ${zenKaku.className}`}
      aria-label="ボラノワ イベント情報セクション"
    >
      <div className={styles.canvas}>
        <div className={styles.backdropEllipse}>
          <Image src={ASSETS.ellipse} alt="" width={1142} height={806} aria-hidden="true" unoptimized />
        </div>

        <section className={styles.section}>
          <div className={styles.heading}>
            <span className={styles.headingIcon}>
              <Image src={ASSETS.calendar} alt="" width={64} height={64} aria-hidden="true" unoptimized />
            </span>
            <h2>イベント情報</h2>
          </div>

          <div className={styles.regionTabs} role="tablist" aria-label="地域タブ">
            {REGIONS.map((region, index) => (
              <button
                key={region}
                type="button"
                role="tab"
                className={`${styles.regionTab} ${index === 0 ? styles.regionTabActive : ""}`}
                aria-selected={index === 0}
              >
                {region}
              </button>
            ))}
          </div>

          <div className={styles.filtersWrapper}>
            <div className={styles.categoryChips}>
              {CATEGORIES.map((category, index) => (
                <button
                  key={category}
                  type="button"
                  className={`${styles.categoryChip} ${index === 2 ? styles.categoryChipActive : ""}`}
                  aria-pressed={index === 2}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className={styles.schedules}>
              {SCHEDULES.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`${styles.scheduleItem} ${schedule.highlight ? styles.scheduleHighlight : ""}`}
                >
                  <span>{schedule.label}</span>
                  {schedule.detail ? <small>{schedule.detail}</small> : null}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.cardGrid}>
            {EXPANDED_EVENTS.map((event, index) => (
              <article key={`${event.id}-${index}`} className={styles.card}>
                <div className={styles.cardImage}>
                  <Image
                    src={event.image}
                    alt=""
                    fill
                    sizes="(max-width: 1920px) 320px"
                    aria-hidden="true"
                    unoptimized
                  />
                </div>
                <div className={styles.cardMeta}>
                  <span className={`${styles.metaTag} ${styles.regionTag}`}>{event.region}</span>
                  <span className={`${styles.metaTag} ${styles.categoryTag}`}>{event.category}</span>
                </div>
                <p className={styles.cardDate}>{event.date}</p>
                <h3 className={styles.cardTitle}>{event.title}</h3>
                <p className={styles.cardBody}>{event.body}</p>
                <p className={styles.cardOrg}>{event.organization}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </Main>
  );
}
