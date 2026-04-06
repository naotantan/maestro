import {
  pgTable, text, varchar, timestamp, uuid, index, integer
} from 'drizzle-orm/pg-core';
import { companies } from './group-a';

// J1: recipes
export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_recipes_company').on(table.company_id),
}));

// J2: recipe_steps
export const recipe_steps = pgTable('recipe_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),
  phase_label: varchar('phase_label', { length: 100 }).notNull(),
  skill: varchar('skill', { length: 255 }),
  instruction: text('instruction').notNull(),
  note: text('note'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxRecipe: index('idx_recipe_steps_recipe').on(table.recipe_id),
}));
