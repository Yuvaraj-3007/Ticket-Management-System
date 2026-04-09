import { z } from "zod";

export const COMMENT_SENDER_TYPES = ["AGENT", "CUSTOMER"] as const;
export type CommentSenderType = (typeof COMMENT_SENDER_TYPES)[number];

export const apiCommentSchema = z.object({
  id:         z.string(),
  content:    z.string(),
  senderType: z.enum(COMMENT_SENDER_TYPES),
  author:     z.object({ id: z.string(), name: z.string() }),
  createdAt:  z.string(),
  attachments: z.array(z.object({
    id:        z.string(),
    filename:  z.string(),
    mimetype:  z.string(),
    size:      z.number(),
    url:       z.string(),
  })).optional().default([]),
});
export const apiCommentsSchema = z.array(apiCommentSchema);
export type ApiComment = z.infer<typeof apiCommentSchema>;

export const createCommentSchema = z.object({
  content: z.string()
    .min(1,    "Reply cannot be empty")
    .max(5000, "Reply must be 5000 characters or fewer"),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const polishReplySchema = z.object({
  content: z.string().min(1, "Content is required").max(5000),
});
export type PolishReplyInput = z.infer<typeof polishReplySchema>;

export const summarizeResponseSchema = z.object({
  summary: z.string(),
});
export type SummarizeResponse = z.infer<typeof summarizeResponseSchema>;
