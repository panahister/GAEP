import { z } from "zod"

export const hostRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.enum([
    "ping",
    "probeAgents",
    "readProduct",
    "createProduct",
    "createInitiative",
    "selectAgent",
    "createCharter",
    "confirmCharter",
    "prepareRun",
    "listRuns",
    "createHandoff",
    "verifyAudit",
  ]),
  params: z.record(z.string(), z.unknown()).default({}),
})

export const hostSuccessSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  result: z.unknown(),
})

export const hostErrorSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).nullable(),
  error: z.object({
    code: z.number().int(),
    message: z.string(),
    data: z.unknown().optional(),
  }),
})

export type HostRequest = z.infer<typeof hostRequestSchema>
export type HostSuccess = z.infer<typeof hostSuccessSchema>
export type HostError = z.infer<typeof hostErrorSchema>
