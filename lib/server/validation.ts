import { z } from "zod";

export const dispatchRequestSchema = z.object({
  incidentId: z.string().min(1),
  resourceId: z.string().min(1),
  recommendedResourceId: z.string().nullish(),
  reason: z.string().max(500).optional(),
});

export const optimizeApplySchema = z.object({
  incidentIds: z.array(z.string().min(1)).optional(),
});

export const scenarioParamSchema = z.object({
  key: z.enum(["NORMAL", "MASS_CASUALTY", "RESOURCE_FAILURE", "TRAFFIC_DISRUPTION", "HOSPITAL_OVERLOAD", "MULTI_INCIDENT"]),
});

export const queryRequestSchema = z.object({
  question: z.string().min(1).max(400),
});

export const dispatchModeSchema = z.object({
  mode: z.enum(["HUMAN_APPROVAL", "AUTO_DISPATCH"]),
});

export const loginRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(40, "Name must be under 40 characters"),
  role: z.enum(["OPERATOR", "SUPERVISOR"]),
});
