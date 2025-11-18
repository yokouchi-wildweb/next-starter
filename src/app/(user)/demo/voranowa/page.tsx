import Image from "next/image";
import { Zen_Kaku_Gothic_New } from "next/font/google";

import { Main } from "@/components/TextBlocks";

import styles from "./page.module.css";

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
});

const ASSETS = {
  headerLogo: "https://www.figma.com/api/mcp/asset/1f0fad9d-64db-40e9-954c-90406f5e9825",
  headerSearchIcon: "https://www.figma.com/api/mcp/asset/88115515-23d4-4fe1-8783-0ea1640b0748",
  headerRegisterIcon: "https://www.figma.com/api/mcp/asset/4a0b7d32-defb-4624-ba9e-9d683d18209a",
  headerPublishIcon: "https://www.figma.com/api/mcp/asset/138bc37d-ad63-469f-b1c9-8d277d833a41",
  headerLoginIcon: "https://www.figma.com/api/mcp/asset/47eb9c51-895e-47b0-abdd-ba20ae71c382",
  heroImage: "https://www.figma.com/api/mcp/asset/a12dd6c0-52be-4fed-937c-7c0b79982160",
  heroWave: "https://www.figma.com/api/mcp/asset/7dbb4f45-45c8-4148-8765-44e46d949eed",
  heroSearchIcon: "https://www.figma.com/api/mcp/asset/66e5ba71-7481-4b6a-b6ed-e15d34eea71e",
  cardIcon: "https://www.figma.com/api/mcp/asset/ab841f52-298c-43ce-96f8-7581c8742b1b",
};

const HEADER_ACTIONS = [
  { id: "search", label: "検索", variant: "green", icon: ASSETS.headerSearchIcon },
  { id: "register", label: "登録", variant: "red", icon: ASSETS.headerRegisterIcon },
  { id: "publish", label: "掲載", variant: "red", icon: ASSETS.headerPublishIcon },
  { id: "login", label: "ログイン", variant: "red", icon: ASSETS.headerLoginIcon },
] as const;

const SEARCH_CARDS = [
  { id: "volunteer", title: "ボランティアを探す！" },
  { id: "job", title: "職員/バイトを探す！" },
] as const;

export default function VoranowaDemoPage() {
  return (
    <Main
      containerType="plain"
      padding="none"
      className={`${styles.page} ${zenKaku.className}`}
      aria-label="ボラノワ デモ"
    >
      <div className={styles.canvas}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <Image
              src={ASSETS.headerLogo}
              alt="ボラノワのロゴ"
              width={438}
              height={131}
              className={styles.logoImage}
              priority
              unoptimized
            />
          </div>

          <p className={styles.tagline}>ボランティアを、身近に。</p>

          <div className={styles.actions}>
            {HEADER_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`${styles.actionButton} ${
                  action.variant === "green" ? styles.actionButtonGreen : styles.actionButtonRed
                }`}
                aria-label={`${action.label}ボタン`}
              >
                <Image
                  src={action.icon}
                  alt=""
                  width={56}
                  height={56}
                  className={styles.actionIcon}
                  aria-hidden="true"
                  unoptimized
                />
              </button>
            ))}

            <button type="button" className={styles.menuButton} aria-label="メニューを開く">
              <span />
              <span />
              <span />
            </button>
          </div>
        </header>

        <section className={styles.hero} aria-label="メインビジュアル">
          <div className={styles.heroBackdrop}>
            <div className={styles.heroBackdropImage}>
              <Image
                src={ASSETS.heroImage}
                alt="ボランティアで花壇を手入れする人々"
                fill
                sizes="(max-width: 1920px) 100vw, 1920px"
                priority
                unoptimized
              />
            </div>
          </div>
          <div className={styles.heroOverlay} />

          <p className={styles.heroMessage}>ボランティアを、身近に。</p>

          <div className={styles.heroSearchBar}>
            <span>キーワード（例：海　清掃）</span>
            <button type="button" aria-label="キーワードで検索">
              <Image
                src={ASSETS.heroSearchIcon}
                alt=""
                width={36}
                height={36}
                className={styles.heroSearchIcon}
                aria-hidden="true"
                unoptimized
              />
            </button>
          </div>

          <div className={styles.heroDots}>
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={`dot-${index}`}
                className={`${styles.heroDot} ${index === 2 ? styles.heroDotActive : ""}`}
              />
            ))}
          </div>

          <Image
            className={styles.heroWave}
            src={ASSETS.heroWave}
            alt=""
            width={1920}
            height={274}
            aria-hidden="true"
            unoptimized
          />
        </section>

        <section className={styles.searchArea}>
          <div className={styles.searchHeadline}>
            <p>「できること」から始めてみませんか？</p>
          </div>

          <div className={styles.cardRow}>
            {SEARCH_CARDS.map((card) => (
              <article key={card.id} className={styles.searchCard}>
                <div className={styles.cardTitle}>
                  <Image
                    src={ASSETS.cardIcon}
                    alt=""
                    width={49}
                    height={49}
                    className={styles.cardIcon}
                    aria-hidden="true"
                    unoptimized
                  />
                  <h3>{card.title}</h3>
                </div>

                <div className={styles.cardControls}>
                  <div className={styles.cardSelect}>
                    <span>地域</span>
                  </div>
                  <div className={styles.cardSelect}>
                    <span>カテゴリー</span>
                  </div>
                  <button type="button" className={styles.cardSubmit}>
                    <span>検索する</span>
                    <small>（1,234件）</small>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </Main>
  );
}
