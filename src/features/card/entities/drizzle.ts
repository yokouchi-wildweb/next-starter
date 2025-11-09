// src/features/card/entities/drizzle.ts

import { pgTable, text, integer, timestamp, primaryKey, uuid, pgEnum } from "drizzle-orm/pg-core";
import { TitleTable } from "@/features/title/entities/drizzle";
import { CardRarityTable } from "@/features/cardRarity/entities/drizzle";
import { CardTagTable } from "@/features/cardTag/entities/drizzle";
import { SeriesTable } from "@/features/series/entities/drizzle";

export const CardTypeEnum = pgEnum("card_type_enum", ["real", "virtual"]);
export const CardStateEnum = pgEnum("card_state_enum", ["active", "inactive"]);

export const CardTable = pgTable("cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  modelNumber: text("model_number"),
  titleId: uuid("title_id")
    .notNull()
    .references(() => TitleTable.id),
  rarityId: uuid("rarity_id")
    .notNull()
    .references(() => CardRarityTable.id),
  marketPrice: integer("market_price"),
  pointValue: integer("point_value"),
  cardType: CardTypeEnum("card_type").notNull(),
  state: CardStateEnum("state").notNull(),
  description: text("description"),
  mainImageUrl: text("main_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const CardToCardTagTable = pgTable(
  "card_to_card_tag",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => CardTable.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => CardTagTable.id, { onDelete: "cascade" }),
  },
  (table) => {
    return { pk: primaryKey({ columns: [table.cardId, table.tagId] }) };
  },
);

export const CardToSeriesTable = pgTable(
  "card_to_series",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => CardTable.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => SeriesTable.id, { onDelete: "cascade" }),
  },
  (table) => {
    return { pk: primaryKey({ columns: [table.cardId, table.seriesId] }) };
  },
);
