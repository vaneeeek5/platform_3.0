import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
  unique,
  index,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["SUPER_ADMIN", "ADMIN", "USER"]);
export const projectRoleEnum = pgEnum("project_role", ["ADMIN", "EDITOR", "VIEWER"]);
export const syncStatusEnum = pgEnum("sync_status", ["IDLE", "RUNNING", "SUCCESS", "ERROR"]);
export const syncTypeEnum = pgEnum("sync_type", ["METRIKA_LEADS", "METRIKA_EXPENSES", "CRM_IMPORT"]);
export const changeSourceEnum = pgEnum("change_source", ["MANUAL", "CRM_IMPORT", "SYNC"]);

// Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("USER"),
  preferences: jsonb("preferences").$type<{
    dashboard?: { granularity?: string, dateRange?: { from?: string, to?: string } },
    expenses?: { dateRange?: { from?: string, to?: string } },
    leads?: { dateRange?: { from?: string, to?: string } }
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  yandexToken: text("yandex_token"),
  yandexCounterId: text("yandex_counter_id"),
  yandexDirectLogins: text("yandex_direct_logins"), // Comma-separated logins
  syncSchedule: text("sync_schedule"),
  syncEnabled: boolean("sync_enabled").default(false),
  syncPeriodDays: integer("sync_period_days").default(1),
  yandexUtmsAllowed: text("yandex_utms_allowed"), // Comma-separated allowed sources
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: syncStatusEnum("last_sync_status").default("IDLE"),
  lastSyncError: text("last_sync_error"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectLinks = pgTable(
  "project_links",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: projectRoleEnum("role").notNull().default("VIEWER"),
    canViewDashboard: boolean("can_view_dashboard").notNull().default(true),
    canViewLeads: boolean("can_view_leads").notNull().default(true),
    canViewExpenses: boolean("can_view_expenses").notNull().default(true),
    canViewSettings: boolean("can_view_settings").notNull().default(false),
    canViewLogs: boolean("can_view_logs").notNull().default(false),
    canManageBackups: boolean("can_manage_backups").notNull().default(false),
  },
  (t) => ({
    unq: unique().on(t.projectId, t.userId),
  })
);

export const trackedGoals = pgTable(
  "tracked_goals",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    goalId: text("goal_id").notNull(),
    goalName: text("goal_name").notNull(),
    displayName: text("display_name"),
    targetStatusId: integer("target_status_id").references(() => targetStatuses.id, { onDelete: "set null" }),
    qualificationStatusId: integer("qualification_status_id").references(() => qualificationStatuses.id, { onDelete: "set null" }),
    isActive: boolean("is_active").default(true),
  },
  (t) => ({
    unq: unique().on(t.projectId, t.goalId),
  })
);

export const targetStatuses = pgTable("target_statuses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  label: text("label").notNull(),
  color: text("color").notNull(),
  isDefault: boolean("is_default").default(false),
  isPositive: boolean("is_positive").default(true),
  sortOrder: integer("sort_order").default(0),
});

export const qualificationStatuses = pgTable("qualification_statuses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  label: text("label").notNull(),
  color: text("color").notNull(),
  isPositive: boolean("is_positive").default(true),
  sortOrder: integer("sort_order").default(0),
});

export const leadStages = pgTable("lead_stages", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  label: text("label").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    metrikaVisitId: text("metrika_visit_id").notNull(),
    metrikaClientId: text("metrika_client_id"),
    date: timestamp("date").notNull(),
    utmCampaign: text("utm_campaign"),
    utmSource: text("utm_source"),
    stageId: integer("stage_id").references(() => leadStages.id, { onDelete: "set null" }),
    campaignId: text("campaign_id"), // Added for better CRM matching if available
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    unq: unique().on(t.projectId, t.metrikaVisitId),
    dateIdx: index("leads_date_idx").on(t.projectId, t.date),
    campaignIdx: index("leads_campaign_idx").on(t.projectId, t.utmCampaign),
  })
);

export const crmStageMappings = pgTable("crm_stage_mappings", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  crmStageName: text("crm_stage_name").notNull(),
  targetStatusId: integer("target_status_id").references(() => targetStatuses.id),
  qualificationStatusId: integer("qualification_status_id").references(() => qualificationStatuses.id),
  leadStageId: integer("lead_stage_id").references(() => leadStages.id),
});

export const goalAchievements = pgTable(
  "goal_achievements",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .references(() => leads.id, { onDelete: "cascade" })
      .notNull(),
    goalId: text("goal_id").notNull(),
    goalName: text("goal_name").notNull(),
    targetStatusId: integer("target_status_id").references(() => targetStatuses.id),
    qualificationStatusId: integer("qualification_status_id").references(
      () => qualificationStatuses.id
    ),
    saleAmount: numeric("sale_amount", { precision: 12, scale: 2 }),
    comment: text("comment"),
    updatedAt: timestamp("updated_at").defaultNow(),
    updatedBy: integer("updated_by").references(() => users.id),
  },
  (t) => ({
    leadIdx: index("ga_lead_idx").on(t.leadId),
    goalIdx: index("ga_goal_idx").on(t.goalId),
    unq: unique("ga_lead_goal_unq").on(t.leadId, t.goalId),
  })
);

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    date: timestamp("date").notNull(),
    campaignId: text("campaign_id"),
    utmCampaign: text("utm_campaign"),
    directOrder: text("direct_order"),
    campaignName: text("campaign_name"),
    visits: integer("visits").default(0),
    clicks: integer("clicks").default(0),
    impressions: integer("impressions").default(0),
    cost: numeric("cost", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    unq: unique().on(t.projectId, t.date, t.utmCampaign),
    dateIdx: index("expenses_date_idx").on(t.projectId, t.date),
    campaignIdx: index("expenses_campaign_idx").on(t.projectId, t.utmCampaign),
  })
);

export const campaignMappings = pgTable(
  "campaign_mappings",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    utmValue: text("utm_value"),
    directValue: text("direct_value"),
    displayName: text("display_name").notNull(),
    isHidden: boolean("is_hidden").default(false),
  }
);

export const crmColumnMappings = pgTable("crm_column_mappings", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  crmColumn: text("crm_column").notNull(),
  platformField: text("platform_field").notNull(),
  valueMapping: jsonb("value_mapping"),
});

export const syncLogs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  type: syncTypeEnum("type").notNull(),
  status: syncStatusEnum("status").notNull(),
  recordsProcessed: integer("records_processed").default(0),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export const changeHistory = pgTable("change_history", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  field: text("field").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  changedBy: integer("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at").defaultNow(),
  source: changeSourceEnum("source").notNull().default("MANUAL"),
});

export const globalSettings = pgTable("global_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
