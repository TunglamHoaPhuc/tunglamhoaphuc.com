// The D1 schema (T23), after the data model of dac-ta-ky-thuat-tunglamhoaphuc.md section 3.1,
// shaped by what the old admin's files really hold (3.1b).
//
// Choices that differ from the spec's sketch, on purpose:
// - Primary keys are text, and are the ids the old admin already uses ("post-1060", "khuong-viet",
//   a slug for areas): importing again lands on the same rows, and the ids in today's URLs, the
//   view counts and the logs stay valid. Rows the new admin creates get ids it makes itself.
// - Small nested blocks an editor changes as one thing (keywords, a video block, a book, the
//   times of an event) are json columns, not tables of their own. Anything several rows point at
//   (areas, clusters, assemblies, categories, pictures) is a table with foreign keys.
// - A picture is a `media` row; the rows that use it point at it and never repeat its address.
//   A file on B2 is stored by its object key (`r2_key`: the same key names it in R2 once copied,
//   and the host in front of it is one setting, MEDIA_BASE); only a file that is not on B2
//   (WordPress) keeps its `url`.
import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** A column that holds JSON as text. */
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();
const position = () => integer("position").notNull().default(0);
const boolean = (name: string) => integer(name, { mode: "boolean" });
const EMPTY_LIST = sql`'[]'`;
const STATUS = ["draft", "review", "published", "archived"] as const;

// ---------------------------------------------------------------- users (referenced by media and the log)

/** A role an admin can give people; the four system roles are made by the seed (scripts/seed-admin.ts). */
export const role = sqliteTable("role", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
	description: text("description").notNull().default(""),
	/** A system role cannot be deleted. */
	isSystem: boolean("is_system").notNull().default(false),
	createdAt: text("created_at"),
	updatedAt: text("updated_at"),
	deletedAt: text("deleted_at"),
});

/** What a role may do: one row per module and action; `scope` "own" limits update and delete to what the person created. */
export const rolePermission = sqliteTable(
	"role_permission",
	{
		roleId: text("role_id")
			.notNull()
			.references(() => role.id, { onDelete: "cascade" }),
		module: text("module").notNull(),
		action: text("action").notNull(),
		scope: text("scope", { enum: ["all", "own"] })
			.notNull()
			.default("all"),
	},
	(table) => [primaryKey({ columns: [table.roleId, table.module, table.action] })],
);

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	name: text("name").notNull().default(""),
	/** The old fixed role; kept so old rows read, no longer used to decide anything (see `roleId`). */
	role: text("role", { enum: ["super_admin", "editor", "coordinator", "viewer"] })
		.notNull()
		.default("viewer"),
	active: boolean("active").notNull().default(true),
	lastLoginAt: text("last_login_at"),
	/** Argon2id, PHC string. Null: the account cannot sign in with a password yet. */
	passwordHash: text("password_hash"),
	passwordChangedAt: text("password_changed_at"),
	mustChangePassword: boolean("must_change_password").notNull().default(false),
	roleId: text("role_id").references(() => role.id),
	lockedAt: text("locked_at"),
	lockedReason: text("locked_reason"),
	failedLogins: integer("failed_logins").notNull().default(0),
	avatarMediaId: text("avatar_media_id"),
	createdAt: text("created_at"),
	updatedAt: text("updated_at"),
	deletedAt: text("deleted_at"),
	deletedBy: text("deleted_by"),
});

/** A sign-in. The access token names it by `id`; every request checks the row, so ending it takes effect at once. */
export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** SHA-256 of the refresh token; the token itself is only ever in the person's cookie. */
		refreshHash: text("refresh_hash").unique(),
		/** The token before the last refresh, still accepted for a short while (two tabs refreshing together). */
		prevRefreshHash: text("prev_refresh_hash"),
		rotatedAt: text("rotated_at"),
		createdAt: text("created_at").notNull(),
		lastUsedAt: text("last_used_at").notNull(),
		expiresAt: text("expires_at").notNull(),
		revokedAt: text("revoked_at"),
		ip: text("ip").notNull().default(""),
		userAgent: text("user_agent").notNull().default(""),
		/** False while the person has given the password but not yet the 2FA code. */
		mfaPassed: boolean("mfa_passed").notNull().default(false),
		/** Wrong 2FA codes given on this session. */
		mfaFailures: integer("mfa_failures").notNull().default(0),
	},
	(table) => [index("session_user").on(table.userId, table.revokedAt)],
);

export const passwordReset = sqliteTable(
	"password_reset",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** SHA-256 of the token mailed to the person. */
		tokenHash: text("token_hash").notNull().unique(),
		createdAt: text("created_at").notNull(),
		expiresAt: text("expires_at").notNull(),
		usedAt: text("used_at"),
		requestedIp: text("requested_ip").notNull().default(""),
	},
	(table) => [index("password_reset_user").on(table.userId)],
);

export const userTotp = sqliteTable("user_totp", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	/** The shared secret, encrypted with ADMIN_ENC_KEY. */
	secretEnc: text("secret_enc").notNull(),
	/** Null until the person has typed a first valid code. */
	enabledAt: text("enabled_at"),
	/** SHA-256 of the one-time recovery codes. */
	recoveryHashes: json<string[]>("recovery_hashes").notNull().default(EMPTY_LIST),
	/** The last 30-second step accepted, so a code cannot be used twice. */
	lastUsedStep: integer("last_used_step").notNull().default(0),
});

/** Counters that slow down guessing: sign-in, 2FA codes, password-reset requests. */
export const authThrottle = sqliteTable("auth_throttle", {
	key: text("key").primaryKey(),
	windowStart: text("window_start").notNull(),
	count: integer("count").notNull().default(0),
	lockedUntil: text("locked_until"),
});

// ---------------------------------------------------------------- pictures

/** A folder of the media library; a tree, three levels deep at most (the admin checks). */
export const mediaFolder = sqliteTable(
	"media_folder",
	{
		id: text("id").primaryKey(),
		parentId: text("parent_id"),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		position: position(),
		createdAt: text("created_at"),
	},
	(table) => [index("media_folder_parent").on(table.parentId, table.position)],
);

export const media = sqliteTable(
	"media",
	{
		/** A hash of the address the picture came from, so importing it again finds the same row. */
		id: text("id").primaryKey(),
		/** The object key of a file on B2 (and of its copy in R2); `null` for a file that is elsewhere. */
		r2Key: text("r2_key"),
		/** The address of a file that is not on B2 (a WordPress upload); `null` when `r2_key` says where it is. */
		url: text("url"),
		folder: text("folder").notNull().default(""),
		filename: text("filename").notNull().default(""),
		mime: text("mime"),
		width: integer("width"),
		height: integer("height"),
		sizeBytes: integer("size_bytes"),
		alt: text("alt").notNull().default(""),
		caption: text("caption").notNull().default(""),
		uploadedBy: text("uploaded_by").references(() => user.id),
		createdAt: text("created_at"),
		/** The library folder; null for what was imported from the old admin (it keeps its text `folder`). */
		folderId: text("folder_id").references(() => mediaFolder.id),
		title: text("title").notNull().default(""),
		/** Goes up by one each time the file is replaced; the file's path carries it, so a new picture is a new address. */
		version: integer("version").notNull().default(1),
		originalFilename: text("original_filename").notNull().default(""),
		/** SHA-256 of the file as stored, to spot a picture uploaded twice. */
		checksum: text("checksum"),
		updatedAt: text("updated_at"),
		updatedBy: text("updated_by"),
		deletedAt: text("deleted_at"),
		deletedBy: text("deleted_by"),
	},
	(table) => [
		index("media_r2_key").on(table.r2Key),
		index("media_folder_id").on(table.folderId),
		index("media_created").on(table.createdAt),
		index("media_deleted").on(table.deletedAt),
		check("media_has_place", sql`${table.r2Key} is not null or ${table.url} is not null`),
	],
);

/** A crop of a picture for one frame shape: where it was cut (in % of the picture) and the cut file. */
export const mediaCrop = sqliteTable(
	"media_crop",
	{
		mediaId: text("media_id")
			.notNull()
			.references(() => media.id, { onDelete: "cascade" }),
		/** "16:9", "4:3", "3:4", "16:10" or "1:1". */
		ratio: text("ratio").notNull(),
		x: real("x").notNull(),
		y: real("y").notNull(),
		width: real("width").notNull(),
		height: real("height").notNull(),
		/** The cut file's key, in the same form as `media.r2_key`. */
		r2Key: text("r2_key").notNull(),
		updatedAt: text("updated_at"),
	},
	(table) => [primaryKey({ columns: [table.mediaId, table.ratio] })],
);

/** Where a picture is used: one row per place. Kept up to date whenever the thing that uses it is saved. */
export const mediaUsage = sqliteTable(
	"media_usage",
	{
		mediaId: text("media_id")
			.notNull()
			.references(() => media.id, { onDelete: "cascade" }),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		field: text("field").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.mediaId, table.entityType, table.entityId, table.field] }),
		index("media_usage_entity").on(table.entityType, table.entityId),
	],
);

export const album = sqliteTable("album", {
	id: text("id").primaryKey(),
	title: text("title").notNull().default(""),
});

export const albumItem = sqliteTable(
	"album_item",
	{
		albumId: text("album_id")
			.notNull()
			.references(() => album.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		mediaId: text("media_id")
			.notNull()
			.references(() => media.id),
		title: text("title").notNull().default(""),
		caption: text("caption").notNull().default(""),
	},
	(table) => [primaryKey({ columns: [table.albumId, table.position] })],
);

// ---------------------------------------------------------------- shared lists

/** Every named group the content falls into: a post's category, an article's group, an assembly of statues. */
export const category = sqliteTable(
	"category",
	{
		/** `${kind}:${section}:${slug}` (section is empty where the kind has one list only). */
		id: text("id").primaryKey(),
		/** "post", "tong-chi", "about", "event", "assembly". */
		kind: text("kind").notNull(),
		/** The part of the site a post category belongs to ("dong-chay-hoang-phap"); empty for the other kinds. */
		section: text("section").notNull().default(""),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		position: position(),
		colorToken: text("color_token"),
	},
	(table) => [index("category_kind").on(table.kind, table.section)],
);

// ---------------------------------------------------------------- posts

export const post = sqliteTable(
	"post",
	{
		id: text("id").primaryKey(),
		/** Not unique: the old admin lets two posts share one (the second is then unreachable by its address). */
		slug: text("slug").notNull(),
		title: text("title").notNull(),
		subtitle: text("subtitle").notNull().default(""),
		/** "dong-chay-hoang-phap", "tri-tue-phat-phap", "vu-tru-phat-giao"… */
		section: text("section").notNull(),
		categoryId: text("category_id").references(() => category.id),
		author: text("author").notNull().default(""),
		/** YYYY-MM-DD. */
		publishedDate: text("published_date").notNull(),
		status: text("status", { enum: STATUS }).notNull().default("published"),
		/** The count the old admin kept inside the post; shown views are this plus the sum of `page_view`. */
		legacyViews: integer("legacy_views").notNull().default(0),
		thumbnailMediaId: text("thumbnail_media_id").references(() => media.id),
		thumbnailPosition: text("thumbnail_position").notNull().default("center 50%"),
		bannerMediaId: text("banner_media_id").references(() => media.id),
		bannerPosition: text("banner_position").notNull().default("center 50%"),
		summary: text("summary").notNull().default(""),
		intro: text("intro").notNull().default(""),
		/** Sanitised HTML. */
		contentHtml: text("content_html").notNull().default(""),
		keywords: json<{ keyword: string; title: string; description: string }[]>("keywords").notNull().default(EMPTY_LIST),
		videos: json<{ id: string; url: string }[]>("videos").notNull().default(EMPTY_LIST),
		albumId: text("album_id").references(() => album.id),
		/** The picture count the lists show (the old admin's own number; the album may hold more). */
		galleryCount: integer("gallery_count").notNull().default(0),
		seoTitle: text("seo_title"),
		seoDescription: text("seo_description"),
		createdAt: text("created_at"),
		updatedAt: text("updated_at"),
	},
	(table) => [
		index("post_slug").on(table.slug),
		index("post_section_date").on(table.section, table.publishedDate),
		index("post_category").on(table.categoryId),
	],
);

// ---------------------------------------------------------------- Tông Chỉ Tu Học

export const teachingArticle = sqliteTable(
	"teaching_article",
	{
		id: text("id").primaryKey(),
		slug: text("slug").notNull().unique(),
		title: text("title").notNull(),
		/** The title, with the subtitle where articles share one title ("Lộ Trình Tu Học: Dành cho người trẻ"). */
		name: text("name").notNull().default(""),
		subtitle: text("subtitle").notNull().default(""),
		groupId: text("group_id").references(() => category.id),
		bannerMediaId: text("banner_media_id").references(() => media.id),
		bannerPosition: text("banner_position").notNull().default("center 50%"),
		excerpt: text("excerpt").notNull().default(""),
		/** The editors' text (light Markdown); turned into HTML when a page is shown. */
		body: text("body").notNull().default(""),
		author: text("author").notNull().default(""),
		authorHref: text("author_href"),
		publishedDate: text("published_date").notNull().default(""),
		legacyViews: integer("legacy_views").notNull().default(0),
		video: json<{ id: string; url: string; title: string; description: string }>("video"),
		featured: json<{ label: string; title: string; author: string; href: string | null }>("featured"),
		book: json<{ title: string; author: string; cover: string | null; description: string; href: string | null }>("book"),
		keywords: json<{ keyword: string; title: string; description: string }[]>("keywords").notNull().default(EMPTY_LIST),
		albumId: text("album_id").references(() => album.id),
		position: position(),
		status: text("status", { enum: STATUS }).notNull().default("published"),
		updatedAt: text("updated_at"),
	},
	(table) => [index("teaching_group").on(table.groupId, table.position)],
);

// ---------------------------------------------------------------- Giới thiệu

export const page = sqliteTable(
	"page",
	{
		id: text("id").primaryKey(),
		slug: text("slug").notNull().unique(),
		title: text("title").notNull(),
		subtitle: text("subtitle").notNull().default(""),
		/** Small label above the title: "Trụ Trì Bổn Tự". */
		kicker: text("kicker").notNull().default(""),
		groupId: text("group_id").references(() => category.id),
		bannerMediaId: text("banner_media_id").references(() => media.id),
		bannerPosition: text("banner_position").notNull().default("center 50%"),
		portraitMediaId: text("portrait_media_id").references(() => media.id),
		portraitPosition: text("portrait_position").notNull().default("center 50%"),
		overview: text("overview").notNull().default(""),
		quote: json<{ title: string; lines: string[]; author: string }>("quote"),
		contentHtml: text("content_html").notNull().default(""),
		book: json<{ title: string; author: string; cover: string | null; description: string }>("book"),
		albumId: text("album_id").references(() => album.id),
		position: position(),
		status: text("status", { enum: STATUS }).notNull().default("published"),
		updatedAt: text("updated_at"),
	},
	(table) => [index("page_group").on(table.groupId, table.position)],
);

export const milestone = sqliteTable(
	"milestone",
	{
		pageId: text("page_id")
			.notNull()
			.references(() => page.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		/** A year, or a phase such as "Thời Cổ Tự". */
		label: text("label").notNull().default(""),
		title: text("title").notNull().default(""),
		description: text("description").notNull().default(""),
	},
	(table) => [primaryKey({ columns: [table.pageId, table.position] })],
);

// ---------------------------------------------------------------- Vũ Trụ Phật Giáo and Bảo Tượng

export const area = sqliteTable("area", {
	id: text("id").primaryKey(),
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
	subtitle: text("subtitle").notNull().default(""),
	/** The temple it belongs to; the old admin is made for several. */
	temple: text("temple").notNull().default(""),
	coverMediaId: text("cover_media_id").references(() => media.id),
	coverPosition: text("cover_position").notNull().default("center 50%"),
	/** Where the editors placed the pin, in % of the map picture. */
	mapX: real("map_x"),
	mapY: real("map_y"),
	intro: text("intro").notNull().default(""),
	contentHtml: text("content_html").notNull().default(""),
	position: position(),
	/** Whether the area shows on the site (T36). */
	visible: boolean("visible").notNull().default(true),
	updatedAt: text("updated_at"),
});

/** A group of statues that stand together ("Hoa Nghiêm Tam Thánh"), inside an assembly (a `category` of kind "assembly"). */
export const statueCluster = sqliteTable(
	"statue_cluster",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		assemblyId: text("assembly_id").references(() => category.id),
		areaId: text("area_id").references(() => area.id),
		description: text("description").notNull().default(""),
	},
	(table) => [index("cluster_area").on(table.areaId)],
);

export const statue = sqliteTable(
	"statue",
	{
		id: text("id").primaryKey(),
		/** "TP0001"; a few have none. */
		code: text("code").notNull().default(""),
		slug: text("slug").notNull().unique(),
		name: text("name").notNull(),
		subtitle: text("subtitle").notNull().default(""),
		areaId: text("area_id").references(() => area.id),
		/** The area as the Bảo Tượng file names it ("tam_bao"), kept so a statue with no area can be told what it was. */
		areaCode: text("area_code").notNull().default(""),
		clusterId: text("cluster_id").references(() => statueCluster.id),
		assemblyId: text("assembly_id").references(() => category.id),
		/** A main statue (TƯỢNG CHÍNH); the others are works of Buddhist art. */
		isMain: boolean("is_main").notNull().default(false),
		imageMediaId: text("image_media_id").references(() => media.id),
		imagePosition: text("image_position").notNull().default("center 50%"),
		quoteText: text("quote_text"),
		quoteAuthor: text("quote_author"),
		/** The editors' text; turned into HTML when a page is shown. */
		body: text("body").notNull().default(""),
		position: position(),
		updatedAt: text("updated_at"),
	},
	(table) => [index("statue_area").on(table.areaId, table.position), index("statue_code").on(table.code)],
);

/** A work of Buddhist art showing the same figure. `artStatueId` points at it when it is a statue of the collection too. */
export const artVariation = sqliteTable(
	"art_variation",
	{
		id: text("id").primaryKey(),
		statueId: text("statue_id")
			.notNull()
			.references(() => statue.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		/** The id the old admin gave the work (a statue id when it is one of the collection, else anything). */
		variationId: text("variation_id").notNull().default(""),
		artStatueId: text("art_statue_id").references(() => statue.id),
		title: text("title").notNull().default(""),
		location: text("location").notNull().default(""),
		meaning: text("meaning").notNull().default(""),
		imageMediaId: text("image_media_id").references(() => media.id),
		imagePosition: text("image_position").notNull().default("center 50%"),
	},
	(table) => [index("art_statue").on(table.statueId, table.position)],
);

// ---------------------------------------------------------------- Danh Tăng

export const monk = sqliteTable(
	"monk",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		lifespan: text("lifespan").notNull().default(""),
		/** "Miền Bắc", "Miền Trung", "Miền Nam", "Quốc tế". */
		region: text("region").notNull().default(""),
		/** "Tăng chúng" or "Ni chúng". */
		sangha: text("sangha").notNull().default(""),
		sect: text("sect").notNull().default(""),
		era: text("era").notNull().default(""),
		subEra: text("sub_era").notNull().default(""),
		avatarMediaId: text("avatar_media_id").references(() => media.id),
		dharmaQuote: text("dharma_quote").notNull().default(""),
		bio: text("bio").notNull().default(""),
		coordX: real("coord_x"),
		coordY: real("coord_y"),
		position: position(),
		updatedAt: text("updated_at"),
	},
	(table) => [index("monk_filters").on(table.region, table.sangha)],
);

// ---------------------------------------------------------------- Lịch tu học

export const calendarEvent = sqliteTable(
	"calendar_event",
	{
		id: text("id").primaryKey(),
		slug: text("slug").notNull(),
		title: text("title").notNull(),
		subtitle: text("subtitle").notNull().default(""),
		categoryId: text("category_id").references(() => category.id),
		/** YYYY-MM-DD; `endDate` equals it for a one-day event. */
		startDate: text("start_date").notNull(),
		endDate: text("end_date").notNull(),
		times: json<{ label: string; time: string }[]>("times").notNull().default(EMPTY_LIST),
		location: text("location").notNull().default(""),
		description: text("description").notNull().default(""),
		notes: text("notes").notNull().default(""),
		imageMediaId: text("image_media_id").references(() => media.id),
		imagePosition: text("image_position").notNull().default("center 50%"),
		video: json<{ id: string; url: string }>("video"),
		/** Order among events of the same dates. */
		position: position(),
		/** A rule for events that come back ("lunar:1,15 monthly"); empty for a single event. */
		recurrenceRule: text("recurrence_rule"),
		linkedPostId: text("linked_post_id").references(() => post.id),
		/** Whether people can register for it (T26, T32). */
		registrationOpen: boolean("registration_open").notNull().default(false),
		updatedAt: text("updated_at"),
	},
	(table) => [index("event_dates").on(table.startDate, table.endDate)],
);

/** A ceremony held on fixed lunar days each month. */
export const featuredProgram = sqliteTable("featured_program", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	subtitle: text("subtitle").notNull().default(""),
	summary: text("summary").notNull().default(""),
	time: text("time").notNull().default(""),
	duration: text("duration").notNull().default(""),
	location: text("location").notNull().default(""),
	imageMediaId: text("image_media_id").references(() => media.id),
	imagePosition: text("image_position").notNull().default("center 50%"),
	position: position(),
});

export const monthTheme = sqliteTable("month_theme", {
	/** 1–12. */
	month: integer("month").primaryKey(),
	title: text("title").notNull().default(""),
	posterMediaId: text("poster_media_id").references(() => media.id),
	/** Lines of the verse as HTML whose only tag is <b>. */
	lines: json<string[]>("lines").notNull().default(EMPTY_LIST),
	author: text("author").notNull().default(""),
});

/** A picture of a verse (kho pháp ngữ), for Lời Thầy dạy. */
export const quoteImage = sqliteTable("quote_image", {
	id: text("id").primaryKey(),
	title: text("title").notNull().default(""),
	mediaId: text("media_id")
		.notNull()
		.references(() => media.id),
	position: position(),
});

// ---------------------------------------------------------------- visitors

/** Views counted per day (T25): written by the site, never by the import. */
export const pageView = sqliteTable(
	"page_view",
	{
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		/** YYYY-MM-DD. */
		date: text("date").notNull(),
		count: integer("count").notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.entityType, table.entityId, table.date] })],
);

/** A sign-up for a retreat (T26): written by the site, never by the import. */
export const registration = sqliteTable(
	"registration",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		/** The code the person is given on the thank-you page. */
		code: text("code").notNull().unique(),
		eventId: text("event_id")
			.notNull()
			.references(() => calendarEvent.id),
		fullName: text("full_name").notNull(),
		dharmaName: text("dharma_name").notNull().default(""),
		phone: text("phone").notNull(),
		email: text("email").notNull().default(""),
		participants: integer("participants").notNull().default(1),
		note: text("note").notNull().default(""),
		status: text("status", { enum: ["new", "confirmed", "cancelled"] })
			.notNull()
			.default("new"),
		createdAt: text("created_at").notNull(),
	},
	(table) => [index("registration_event").on(table.eventId, table.status)],
);

// ---------------------------------------------------------------- site settings and admin

export const setting = sqliteTable("setting", {
	key: text("key").primaryKey(),
	value: json<unknown>("value").notNull(),
});

export const notice = sqliteTable("notice", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	body: text("body").notNull().default(""),
	/** "v1.0.0": a changed version shows the notice again to people who closed it. */
	version: text("version").notNull().default("v1.0.0"),
	active: boolean("active").notNull().default(true),
	showOnce: boolean("show_once").notNull().default(false),
	/** YYYY-MM-DD; the notice hides itself after it. */
	expiresOn: text("expires_on"),
});

export const auditLog = sqliteTable(
	"audit_log",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		userId: text("user_id").references(() => user.id),
		action: text("action").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		diff: json<unknown>("diff"),
		createdAt: text("created_at").notNull(),
		/** Kept even if the account is later deleted. */
		userEmail: text("user_email").notNull().default(""),
		/** The fields that changed, before and after; secrets blanked, long text cut (src/admin/audit/log.ts). */
		dataBefore: json<unknown>("data_before"),
		dataAfter: json<unknown>("data_after"),
		ip: text("ip").notNull().default(""),
		userAgent: text("user_agent").notNull().default(""),
		requestId: text("request_id").notNull().default(""),
	},
	(table) => [
		index("audit_entity").on(table.entityType, table.entityId),
		index("audit_time").on(table.createdAt),
		index("audit_user_time").on(table.userId, table.createdAt),
		index("audit_action_time").on(table.action, table.createdAt),
	],
);

export const redirect = sqliteTable("redirect", {
	fromPath: text("from_path").primaryKey(),
	toPath: text("to_path").notNull(),
	code: integer("code").notNull().default(301),
});
