import { z } from "zod";

const score = z.number().int().min(0).max(100);

export const contentTalentSchema = z.object({
  id: z.string().min(3).max(160).regex(/^talent-[a-z0-9-]+$/),
  name: z.string().trim().min(1).max(160),
  type: z.enum(["actor", "director", "writer", "composer"]),
  gender: z.string().min(1).max(40),
  nationality: z.string().min(1).max(100),
  starRating: z.number().int().min(1).max(5),
  askingPrice: z.number().int().nonnegative(),
  boxOfficeAvg: z.number().int().nonnegative(),
  awards: z.number().int().nonnegative(),
  genres: z.record(z.string(), score),
  genreTags: z.array(z.string().min(1).max(40)),
  isActive: z.boolean(),
  imageUrl: z.string().url().nullable(),
  birthYear: z.number().int().min(1850).max(2100).nullable(),
  popularity: score,
  performance: score,
  experience: score,
  fame: score,
  skillAction: score,
  skillDrama: score,
  skillComedy: score,
  skillThriller: score,
  skillHorror: score,
  skillScifi: score,
  skillAnimation: score,
  skillRomance: score,
  skillFantasy: score,
  skillMusicals: score,
  skillCinematography: score,
  skillEditing: score,
  skillOrchestral: score,
  skillElectronic: score,
}).strict();

export const baseContentSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.number().int().positive(),
  talent: z.array(contentTalentSchema).min(1).superRefine((rows, context) => {
    const ids = new Set<string>();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (ids.has(row.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "id"],
          message: `Duplicate stable talent id: ${row.id}`,
        });
      }
      ids.add(row.id);
    }
  }),
}).strict();

export const contentManifestSchema = z.object({
  contentVersion: z.number().int().positive(),
  schemaVersion: z.literal(1),
  contentFile: z.string().min(1).max(240),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  talentCount: z.number().int().positive(),
}).strict();

export type BaseContent = z.infer<typeof baseContentSchema>;
export type ContentManifest = z.infer<typeof contentManifestSchema>;
